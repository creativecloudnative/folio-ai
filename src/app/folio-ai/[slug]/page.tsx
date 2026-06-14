import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { getFolioBySlug, setFolioVisibility } from '@/lib/folios'
import {
  getPublishedCompositionsForFolio,
  getFolioComposition,
  getCompositionItems,
  type Composition,
} from '@/lib/compositions'
import { sql } from '@/lib/db'
import ChatButton from '@/components/ChatButton'
import SignOutButton from '@/components/SignOutButton'
import RefreshFolioButton from '@/components/RefreshFolioButton'

export const revalidate = 300

// ── Types ─────────────────────────────────────────────────────────────────────

type FolioCard = {
  id: string
  title: string
  excerpt: string
  viewer_href: string
  published: boolean  // false = draft, shown to owner only
}

type FolioSection = {
  label: string    // section_label from folio item — this is the heading on the page
  anchor: string   // URL-safe anchor derived from label
  cards: FolioCard[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractExcerpt(content: string, maxLen = 220): string {
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (t && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('```')) {
      return t.length > maxLen ? t.slice(0, maxLen - 3) + '…' : t
    }
  }
  return ''
}

function labelToAnchor(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'
}

function compositionViewerHref(folioSlug: string, comp: Pick<Composition, 'type' | 'slug'>): string {
  if (comp.type === 'architecture') return `/folio-ai/${folioSlug}/architecture/${comp.slug}`
  if (comp.type === 'case-study')   return `/folio-ai/${folioSlug}/case-studies/${comp.slug}`
  return `/folio-ai/${folioSlug}/doc?source=content/${comp.type}/${comp.slug}.md`
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchIntroExcerpt(ownerId: string): Promise<string> {
  try {
    const rows = await sql`
      SELECT content FROM documents
      WHERE owner_id = ${ownerId} AND type = 'bio'
      ORDER BY created_at DESC LIMIT 1
    `
    return rows[0]?.content ? extractExcerpt(rows[0].content as string, 320) : ''
  } catch { return '' }
}

async function buildSections(
  ownerId: string,
  folioSlug: string,
  isOwner: boolean,
): Promise<FolioSection[]> {
  const folioComp = await getFolioComposition(ownerId)

  // ── Fallback: no folio composition configured ──────────────────────────────
  // Group all (owner) or published (visitor) compositions by type_name.
  if (!folioComp) {
    const comps = isOwner
      ? (await sql`
          SELECT c.id, c.owner_id, c.type, c.title, c.slug, c.published, c.created_at, c.updated_at,
                 COALESCE(ct.name, c.type) AS type_name
          FROM compositions c
          LEFT JOIN composition_types ct ON ct.slug = c.type AND ct.owner_id = c.owner_id
          WHERE c.owner_id = ${ownerId} AND COALESCE(ct.folio_visible, TRUE) AND c.type != 'folio'
          ORDER BY COALESCE(ct.position, 99) ASC, c.updated_at DESC
        `) as Array<Composition & { type_name: string }>
      : await getPublishedCompositionsForFolio(ownerId)

    return buildFallbackSections(comps, ownerId, folioSlug)
  }

  // ── Primary: use folio composition items ──────────────────────────────────
  const items = await getCompositionItems(folioComp.id)
  const contentItems = items.filter((it) => it.document_source || it.ref_composition_id)

  if (contentItems.length === 0) {
    if (!isOwner) return []
    const comps = await getPublishedCompositionsForFolio(ownerId)
    return buildFallbackSections(comps as Array<Composition & { type_name: string }>, ownerId, folioSlug)
  }

  // Batch-fetch all compositions for the owner (used by composition-ref items)
  const allComps = isOwner
    ? (await sql`
        SELECT c.id, c.type, c.title, c.slug, c.published,
               COALESCE(ct.name, c.type) AS type_name
        FROM compositions c
        LEFT JOIN composition_types ct ON ct.slug = c.type AND ct.owner_id = c.owner_id
        WHERE c.owner_id = ${ownerId} AND c.type != 'folio'
      `) as Array<{ id: string; type: string; title: string; slug: string; published: boolean; type_name: string }>
    : (await sql`
        SELECT c.id, c.type, c.title, c.slug, c.published,
               COALESCE(ct.name, c.type) AS type_name
        FROM compositions c
        LEFT JOIN composition_types ct ON ct.slug = c.type AND ct.owner_id = c.owner_id
        WHERE c.owner_id = ${ownerId} AND c.type != 'folio' AND c.published = TRUE
      `) as Array<{ id: string; type: string; title: string; slug: string; published: boolean; type_name: string }>

  const compById = new Map(allComps.map((c) => [c.id, c]))

  // Resolve each folio item to a card
  const resolved = await Promise.all(
    contentItems.map(async (item): Promise<{ sectionLabel: string; card: FolioCard } | null> => {

      if (item.ref_composition_id) {
        const comp = compById.get(item.ref_composition_id)
        if (!comp) return null  // composition was deleted or visitor can't see draft

        const typeFolder = comp.type === 'case-study' ? 'case-studies' : comp.type
        const source = `content/${typeFolder}/${comp.slug}.md`
        let excerpt = ''
        try {
          const rows = await sql`
            SELECT content FROM documents
            WHERE owner_id = ${ownerId} AND source = ${source}
            ORDER BY created_at DESC LIMIT 1
          `
          if (rows[0]?.content) excerpt = extractExcerpt(rows[0].content as string)
        } catch { /* no compiled doc yet */ }

        // section_label on the folio item IS the section title; fall back to type name
        const sectionLabel = item.section_label?.trim() || comp.type_name

        return {
          sectionLabel,
          card: {
            id: item.id,
            title: comp.title,
            excerpt,
            viewer_href: compositionViewerHref(folioSlug, comp),
            published: comp.published,
          },
        }
      }

      if (item.document_source) {
        const rows = await sql`
          SELECT title, content FROM documents
          WHERE owner_id = ${ownerId} AND source = ${item.document_source}
          ORDER BY created_at DESC LIMIT 1
        `
        const doc = rows[0]
        if (!doc) return null

        const sectionLabel = item.section_label?.trim() || 'Documents'

        return {
          sectionLabel,
          card: {
            id: item.id,
            title: (doc.title as string) || item.document_source || 'Document',
            excerpt: doc.content ? extractExcerpt(doc.content as string) : '',
            viewer_href: `/folio-ai/${folioSlug}/doc?source=${encodeURIComponent(item.document_source!)}`,
            published: true,
          },
        }
      }

      return null
    }),
  )

  // Group by sectionLabel, preserving order of first occurrence
  const sectionOrder: string[] = []
  const grouped: Record<string, FolioCard[]> = {}

  for (const r of resolved) {
    if (!r) continue
    if (!grouped[r.sectionLabel]) {
      sectionOrder.push(r.sectionLabel)
      grouped[r.sectionLabel] = []
    }
    grouped[r.sectionLabel].push(r.card)
  }

  return sectionOrder
    .map((label) => ({ label, anchor: labelToAnchor(label), cards: grouped[label] }))
    .filter((s) => s.cards.length > 0)
}

// Fallback grouping (no folio composition) — group published comps by type_name
async function buildFallbackSections(
  comps: Array<Composition & { type_name: string }>,
  ownerId: string,
  folioSlug: string,
): Promise<FolioSection[]> {
  if (comps.length === 0) return []

  const sectionOrder: string[] = []
  const grouped: Record<string, FolioCard[]> = {}

  await Promise.all(
    comps.map(async (comp) => {
      const typeFolder = comp.type === 'case-study' ? 'case-studies' : comp.type
      const source = `content/${typeFolder}/${comp.slug}.md`
      let excerpt = ''
      try {
        const rows = await sql`
          SELECT content FROM documents WHERE owner_id = ${ownerId} AND source = ${source}
          ORDER BY created_at DESC LIMIT 1
        `
        if (rows[0]?.content) excerpt = extractExcerpt(rows[0].content as string)
      } catch { /* no doc yet */ }

      const label = comp.type_name
      if (!grouped[label]) {
        sectionOrder.push(label)
        grouped[label] = []
      }
      grouped[label].push({
        id: comp.id,
        title: comp.title,
        excerpt,
        viewer_href: compositionViewerHref(folioSlug, comp),
        published: comp.published,
      })
    }),
  )

  return sectionOrder
    .map((label) => ({ label, anchor: labelToAnchor(label), cards: grouped[label] }))
    .filter((s) => s.cards.length > 0)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const folio = await getFolioBySlug(slug)
  if (!folio) return {}
  return {
    title: `${folio.name} — folio-ai`,
    description: `${folio.name}'s AI-native portfolio`,
  }
}

export default async function FolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [folio, session] = await Promise.all([getFolioBySlug(slug), auth()])

  if (!folio) notFound()

  const isOwner = session?.user?.id === folio.owner_id

  // Private folios are only visible to the owner
  if (!folio.is_public && !isOwner) notFound()

  async function toggleVisibility() {
    'use server'
    const f = await getFolioBySlug(slug)
    if (!f || !isOwner) return
    await setFolioVisibility(f.owner_id, !f.is_public)
    revalidatePath(`/folio-ai/${slug}`)
    redirect(`/folio-ai/${slug}`)
  }

  const [sections, bioExcerpt] = await Promise.all([
    buildSections(folio.owner_id, slug, isOwner),
    fetchIntroExcerpt(folio.owner_id),
  ])

  const hasContent = sections.length > 0

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800/60 px-6 py-4 sticky top-0 bg-zinc-950/80 backdrop-blur z-10">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/folio-ai" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← folio-ai
          </Link>
          <div className="flex items-center gap-3">
            {sections.map((section) => (
              <a
                key={section.anchor}
                href={`#${section.anchor}`}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block"
              >
                {section.label}
              </a>
            ))}
            <a href="#contact" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block">Contact</a>
            {isOwner && (
              <>
                <form action={toggleVisibility}>
                  <button
                    type="submit"
                    title={folio.is_public ? 'Visible to anyone — click to make private' : 'Only you can see this — click to make public'}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      folio.is_public
                        ? 'border-emerald-700/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40'
                        : 'border-zinc-600 bg-zinc-900/60 text-zinc-400 hover:border-zinc-400'
                    }`}
                  >
                    {folio.is_public ? '● Public' : '○ Private'}
                  </button>
                </form>
                <RefreshFolioButton />
                <Link
                  href={`/folio-ai/${slug}/design`}
                  className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                >
                  Studio
                </Link>
                <SignOutButton className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                  Sign out
                </SignOutButton>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[500px] bg-indigo-900/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-900/10 rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28">
          <p className="text-sm font-mono text-indigo-400 mb-4 tracking-widest uppercase">
            Portfolio
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
            {folio.name}
          </h1>
          {bioExcerpt ? (
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl leading-relaxed mb-10">
              {bioExcerpt}
            </p>
          ) : (
            <p className="text-lg text-zinc-500 max-w-xl mb-10">
              Ask the assistant anything about my work and experience.
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            {hasContent && (
              <a
                href={`#${sections[0].anchor}`}
                className="px-5 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                View work
              </a>
            )}
            <a
              href="#contact"
              className="px-5 py-2.5 rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm font-medium transition-colors"
            >
              Get in touch
            </a>
          </div>
        </div>
      </section>

      {/* Content sections — one per unique section_label */}
      {sections.map((section) => (
        <section key={section.anchor} id={section.anchor} className="border-t border-zinc-800/60 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <p className="text-sm font-mono text-indigo-400 mb-3 tracking-widest uppercase">
              {section.label}
            </p>
            <h2 className="text-3xl font-bold text-white mb-12">{section.label}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {section.cards.map((card) => card.published ? (
                <Link
                  key={card.id}
                  href={card.viewer_href}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-700 p-6 flex flex-col gap-3 transition-colors"
                >
                  <h3 className="text-base font-semibold text-white leading-snug">{card.title}</h3>
                  {card.excerpt && (
                    <p className="text-sm text-zinc-400 leading-relaxed flex-1">{card.excerpt}</p>
                  )}
                  <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">
                    Read more →
                  </span>
                </Link>
              ) : (
                <div
                  key={card.id}
                  className="rounded-xl border border-zinc-800/50 border-dashed bg-zinc-900/20 p-6 flex flex-col gap-3 opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-700/50 bg-amber-900/30 text-amber-400">draft</span>
                  </div>
                  <h3 className="text-base font-semibold text-white leading-snug">{card.title}</h3>
                  <p className="text-xs text-zinc-600">Publish this composition to make it visible.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Empty state */}
      {!hasContent && (
        <section className="border-t border-zinc-800/60 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <p className="text-zinc-500">No published content yet — check back soon.</p>
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="border-t border-zinc-800/60 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-sm font-mono text-indigo-400 mb-3 tracking-widest uppercase">
            Get in touch
          </p>
          <h2 className="text-3xl font-bold text-white mb-4">Let&apos;s talk</h2>
          <p className="text-zinc-400 max-w-lg mb-8">
            Use the chat assistant to ask about my experience, or reach out directly.
          </p>
          <p className="text-xs text-zinc-600">
            Powered by{' '}
            <Link href="/folio-ai" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              folio-ai
            </Link>
            {' · '}
            <Link href="/folio-ai/under-the-hood" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              how it works
            </Link>
          </p>
        </div>
      </section>

      <ChatButton
        apiPath={`/api/folio-ai/${slug}/chat`}
        capabilitiesUrl="/folio-ai/assistant"
      />
    </div>
  )
}
