import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getFolioBySlug, getFolioByOwnerId } from '@/lib/folios'
import { isFolioInvited } from '@/lib/invites'

import {
  getPublishedCompositionsForFolio,
  getFolioComposition,
  getCompositionItems,
  type Composition,
} from '@/lib/compositions'
import { sql } from '@/lib/db'
import { getFolioVideos } from '@/lib/videos'
import Image from 'next/image'
import ChatButton from '@/components/ChatButton'
import SignOutButton from '@/components/SignOutButton'
import RefreshFolioButton from '@/components/RefreshFolioButton'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

type FolioCard = {
  id: string
  title: string
  excerpt: string
  viewer_href: string
  published: boolean  // false = draft, shown to owner only
  display: 'prose' | 'card'
}

// Document types that render as readable prose blocks rather than clickable cards
const PROSE_TYPES = new Set(['greeting', 'bio'])

// One composition (or direct document) within a section
type FolioSubSection = {
  title: string      // composition title, or doc-type label for direct document items
  cards: FolioCard[] // documents inside that composition (or the doc itself)
}

type FolioSection = {
  label: string         // section_label from folio item — the top-level heading
  anchor: string        // URL-safe anchor
  subsections: FolioSubSection[]
}

const DOC_TYPE_LABELS: Record<string, string> = {
  greeting: 'Greeting',
  bio: 'Bio',
  resume: 'Resume',
  'case-study': 'Case Study',
  architecture: 'Architecture',
  'code-demo': 'Code Demo',
  journal: 'Journal',
  adr: 'ADR',
  diagram: 'Diagram',
  memory: 'Note',
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

// Code demos have no prose body (just a title + a fenced spec), so extractExcerpt
// legitimately finds nothing — give those cards a real description instead of a blank one.
const CODE_DEMO_EXCERPT = 'Live, runnable code — click to try it in the browser.'

function excerptFor(content: string, type: string): string {
  return extractExcerpt(content) || (type === 'code-demo' ? CODE_DEMO_EXCERPT : '')
}

// For prose display: concatenate paragraphs up to maxLen rather than just the first line
function extractProseBlock(content: string, maxLen = 800): string {
  const parts: string[] = []
  let total = 0
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('---') || t.startsWith('```')) continue
    if (total + t.length > maxLen) {
      if (parts.length === 0) parts.push(t.slice(0, maxLen - 3) + '…')
      else parts[parts.length - 1] += '…'
      break
    }
    parts.push(t)
    total += t.length
  }
  return parts.join(' ')
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

// Hero content comes from the folio composition's 'hero' slot, not auto-fetched by type
async function fetchHeroContent(ownerId: string): Promise<string> {
  try {
    const folioComp = await getFolioComposition(ownerId)
    if (!folioComp) return ''
    const folioItems = await getCompositionItems(folioComp.id)
    const heroItem = folioItems.find((it) => it.section_label === 'hero' && it.document_source)
    if (!heroItem?.document_source) return ''
    const rows = await sql`
      SELECT content FROM documents
      WHERE owner_id = ${ownerId} AND source = ${heroItem.document_source}
      ORDER BY created_at ASC
    `
    if (rows.length === 0) return ''
    // Combine all saves (oldest first) — bio is often written across multiple inserts
    const combined = rows
      .map((r) => (r.content as string).trim())
      .filter(Boolean)
      .join('\n\n')
    // Strip markdown headings and code fences; preserve paragraph breaks
    return combined
      .split('\n')
      .filter((l) => !l.startsWith('#') && !l.startsWith('```') && l.trim() !== '---')
      .join('\n')
      .trim()
  } catch { return '' }
}

async function buildSections(
  ownerId: string,
  folioSlug: string,
  isOwner: boolean,
): Promise<FolioSection[]> {
  const folioComp = await getFolioComposition(ownerId)

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

  const items = await getCompositionItems(folioComp.id)
  // 'hero' items feed the folio hero slot, not the sections
  const contentItems = items.filter((it) =>
    (it.document_source || it.ref_composition_id) && it.section_label !== 'hero'
  )

  if (contentItems.length === 0) {
    if (!isOwner) return []
    const comps = await getPublishedCompositionsForFolio(ownerId)
    return buildFallbackSections(comps as Array<Composition & { type_name: string }>, ownerId, folioSlug)
  }

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

  type Resolved = { sectionLabel: string; subsection: FolioSubSection } | null

  const resolved: Resolved[] = await Promise.all(
    contentItems.map(async (item): Promise<Resolved> => {

      if (item.ref_composition_id) {
        const comp = compById.get(item.ref_composition_id)
        if (!comp) return null

        const sectionLabel = item.section_label?.trim() || comp.type_name

        // Recurse into the composition's items to get document cards
        const compItems = await getCompositionItems(item.ref_composition_id)
        const docItems = compItems.filter((ci) => ci.document_source)

        const cards: FolioCard[] = (await Promise.all(
          docItems.map(async (ci): Promise<FolioCard | null> => {
            if (!ci.document_source) return null
            const rows = await sql`
              SELECT title, content FROM documents
              WHERE owner_id = ${ownerId} AND source = ${ci.document_source}
              ORDER BY created_at DESC LIMIT 1
            `
            const doc = rows[0]
            if (!doc) return null
            return {
              id: ci.id,
              title: (doc.title as string) || ci.section_label || 'Document',
              excerpt: doc.content ? excerptFor(doc.content as string, comp.type) : '',
              viewer_href: compositionViewerHref(folioSlug, comp),
              published: comp.published,
              display: 'card' as const,
            }
          })
        )).filter((c): c is FolioCard => c !== null)

        // If composition has no document items yet, show the composition itself as a single card
        if (cards.length === 0) {
          let excerpt = ''
          try {
            const typeFolder = comp.type === 'case-study' ? 'case-studies' : comp.type
            const rows = await sql`
              SELECT content FROM documents
              WHERE owner_id = ${ownerId} AND source = ${'content/' + typeFolder + '/' + comp.slug + '.md'}
              ORDER BY created_at DESC LIMIT 1
            `
            if (rows[0]?.content) excerpt = excerptFor(rows[0].content as string, comp.type)
          } catch { /* no compiled doc yet */ }
          cards.push({
            id: item.id,
            title: comp.title,
            excerpt,
            viewer_href: compositionViewerHref(folioSlug, comp),
            published: comp.published,
            display: 'card',
          })
        }

        return { sectionLabel, subsection: { title: comp.title, cards } }
      }

      if (item.document_source) {
        const rows = await sql`
          SELECT title, content, type FROM documents
          WHERE owner_id = ${ownerId} AND source = ${item.document_source}
          ORDER BY created_at DESC LIMIT 1
        `
        const doc = rows[0]
        if (!doc) return null
        const docType = doc.type as string
        const display: 'prose' | 'card' = PROSE_TYPES.has(docType) ? 'prose' : 'card'
        const sectionLabel = item.section_label?.trim() || 'Documents'
        const typeLabel = DOC_TYPE_LABELS[docType] ?? docType ?? 'Document'
        return {
          sectionLabel,
          subsection: {
            title: typeLabel,
            cards: [{
              id: item.id,
              title: (doc.title as string) || 'Document',
              excerpt: doc.content
                ? display === 'prose'
                  ? extractProseBlock(doc.content as string)
                  : excerptFor(doc.content as string, docType)
                : '',
              viewer_href: `/folio-ai/${folioSlug}/doc?source=${encodeURIComponent(item.document_source!)}`,
              published: true,
              display,
            }],
          },
        }
      }

      return null
    }),
  )

  const sectionOrder: string[] = []
  const grouped: Record<string, FolioSubSection[]> = {}

  for (const r of resolved) {
    if (!r) continue
    if (!grouped[r.sectionLabel]) {
      sectionOrder.push(r.sectionLabel)
      grouped[r.sectionLabel] = []
    }
    grouped[r.sectionLabel].push(r.subsection)
  }

  return sectionOrder
    .map((label) => ({
      label,
      anchor: labelToAnchor(label),
      subsections: grouped[label].filter((s) => s.cards.length > 0),
    }))
    .filter((s) => s.subsections.length > 0)
}

// Fallback: no folio composition configured — group compositions by type, each as a sub-section
async function buildFallbackSections(
  comps: Array<Composition & { type_name: string }>,
  ownerId: string,
  folioSlug: string,
): Promise<FolioSection[]> {
  if (comps.length === 0) return []

  const sectionOrder: string[] = []
  const grouped: Record<string, FolioSubSection[]> = {}

  // Sequential to preserve sort order from the query
  for (const comp of comps) {
    const compItems = await getCompositionItems(comp.id)
    const docItems = compItems.filter((ci) => ci.document_source)

    const cards: FolioCard[] = (await Promise.all(
      docItems.map(async (ci): Promise<FolioCard | null> => {
        if (!ci.document_source) return null
        const rows = await sql`
          SELECT title, content FROM documents
          WHERE owner_id = ${ownerId} AND source = ${ci.document_source}
          ORDER BY created_at DESC LIMIT 1
        `
        const doc = rows[0]
        if (!doc) return null
        return {
          id: ci.id,
          title: (doc.title as string) || ci.section_label || 'Document',
          excerpt: doc.content ? excerptFor(doc.content as string, comp.type) : '',
          viewer_href: compositionViewerHref(folioSlug, comp),
          published: comp.published,
          display: 'card' as const,
        }
      })
    )).filter((c): c is FolioCard => c !== null)

    if (cards.length === 0) {
      let excerpt = ''
      try {
        const typeFolder = comp.type === 'case-study' ? 'case-studies' : comp.type
        const rows = await sql`
          SELECT content FROM documents WHERE owner_id = ${ownerId}
          AND source = ${'content/' + typeFolder + '/' + comp.slug + '.md'}
          ORDER BY created_at DESC LIMIT 1
        `
        if (rows[0]?.content) excerpt = excerptFor(rows[0].content as string, comp.type)
      } catch { /* no doc yet */ }
      cards.push({
        id: comp.id,
        title: comp.title,
        excerpt,
        viewer_href: compositionViewerHref(folioSlug, comp),
        published: comp.published,
        display: 'card',
      })
    }

    const label = comp.type_name
    if (!grouped[label]) {
      sectionOrder.push(label)
      grouped[label] = []
    }
    grouped[label].push({ title: comp.title, cards })
  }

  return sectionOrder
    .map((label) => ({
      label,
      anchor: labelToAnchor(label),
      subsections: grouped[label].filter((s) => s.cards.length > 0),
    }))
    .filter((s) => s.subsections.length > 0)
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

  // Private folios are visible to the owner and explicitly invited emails
  const isInvited = !folio.is_public && !isOwner && !!session?.user?.email
    ? await isFolioInvited(folio.id, session.user.email!)
    : false

  if (!folio.is_public && !isOwner && !isInvited) notFound()

  const [sections, heroContent, videos, viewerFolio] = await Promise.all([
    buildSections(folio.owner_id, slug, isOwner),
    fetchHeroContent(folio.owner_id),
    getFolioVideos(folio.id),
    (!isOwner && session?.user?.id) ? getFolioByOwnerId(session.user.id) : Promise.resolve(null),
  ])

  const hasStudioAccess = !isOwner && folio.studio_is_public

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
            {videos.length > 0 && (
              <a href="#videos" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block">Videos</a>
            )}
            <a href="#contact" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block">Contact</a>
            {isOwner && (
              <>
                <RefreshFolioButton />
                <Link
                  href={`/folio-ai/${slug}/design`}
                  className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                >
                  ✦ Studio
                </Link>
                <Link
                  href={`/folio-ai/${slug}/settings`}
                  className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Settings
                </Link>
              </>
            )}
            {hasStudioAccess && (
              <Link
                href={`/folio-ai/${slug}/design`}
                className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-[0_0_12px_rgba(99,102,241,0.5)] hover:shadow-[0_0_18px_rgba(99,102,241,0.7)] transition-all"
              >
                ✦ Open Studio
              </Link>
            )}
            {!isOwner && viewerFolio && (
              <Link
                href={`/folio-ai/${viewerFolio.slug}`}
                className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
              >
                My folio
              </Link>
            )}
            {session?.user && (
              <SignOutButton className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                Sign out
              </SignOutButton>
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
          <div className="flex flex-col md:flex-row md:items-start md:gap-12">
            {folio.headshot_visible && folio.headshot_url && (
              <div className="shrink-0 mb-8 md:mb-0 md:order-last">
                <div className="w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden border-2 border-zinc-700/60 shadow-xl">
                  <Image
                    src={`/api/folio-ai/${slug}/headshot`}
                    alt={folio.name}
                    width={176}
                    height={176}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                </div>
              </div>
            )}
            <div className="flex-1">
          <p className="text-sm font-mono text-indigo-400 mb-4 tracking-widest uppercase">
            Portfolio
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
            {folio.name}
          </h1>
          {heroContent ? (
            <div className="text-lg md:text-xl text-zinc-400 max-w-2xl leading-relaxed mb-10 space-y-4">
              {heroContent.split(/\n\n+/).filter(Boolean).map((para, i) => (
                <p key={i}>{para.trim()}</p>
              ))}
            </div>
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

            <div className="space-y-14">
              {section.subsections.map((sub, subIdx) => {
                const isProse = sub.cards.some((c) => c.display === 'prose')
                return (
                  <div key={subIdx}>
                    <h3 className="text-lg font-semibold text-zinc-200 mb-6 pb-2 border-b border-zinc-800/80">
                      {sub.title}
                    </h3>

                    {isProse ? (
                      // Prose rendering — full-width readable text, no card chrome
                      <div className="space-y-5">
                        {sub.cards.map((card) => (
                          <div key={card.id}>
                            <p className="text-base text-zinc-300 leading-relaxed">{card.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Card rendering — clickable grid tiles
                      <div className="grid md:grid-cols-2 gap-6">
                        {sub.cards.map((card) => card.published ? (
                          <Link
                            key={card.id}
                            href={card.viewer_href}
                            className="group rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-700 p-6 flex flex-col gap-3 transition-colors"
                          >
                            <h4 className="text-base font-semibold text-white leading-snug">{card.title}</h4>
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
                            <h4 className="text-base font-semibold text-white leading-snug">{card.title}</h4>
                            <p className="text-xs text-zinc-600">Publish this composition to make it visible.</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
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

      {/* Talks & Videos */}
      {videos.length > 0 && (
        <section id="videos" className="border-t border-zinc-800/60 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <p className="text-sm font-mono text-indigo-400 mb-3 tracking-widest uppercase">Talks &amp; Videos</p>
            <h2 className="text-3xl font-bold text-white mb-12">Talks &amp; Videos</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map(video => (
                <a
                  key={video.id}
                  href={`https://www.youtube.com/watch?v=${video.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-700 overflow-hidden transition-colors flex flex-col"
                >
                  <div className="relative aspect-video overflow-hidden bg-zinc-900">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-indigo-600/80 transition-colors">
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-1 flex-1">
                    <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-indigo-300 transition-colors">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-xs text-zinc-500 leading-relaxed">{video.description}</p>
                    )}
                  </div>
                </a>
              ))}
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
            {process.env.NEXT_PUBLIC_COMMIT_SHA && (
              <>{' · '}<span title="build">{process.env.NEXT_PUBLIC_COMMIT_SHA}</span></>
            )}
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
