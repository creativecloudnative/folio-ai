import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { getFolioComposition, getCompositionItems, getComposition } from '@/lib/compositions'
import { sql } from '@/lib/db'
import { ingestDocument } from '@/lib/ingest'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id || !session.user.folioSlug) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const ownerId = session.user.id

  // Compile the folio composition into a pinned 'folio' document
  try {
    const folioComp = await getFolioComposition(ownerId)
    if (folioComp) {
      const items = await getCompositionItems(folioComp.id)

      const sections: string[] = []

      // Document items — only include bio documents for the intro; other document
      // types (memory, resume, etc.) added to the folio composition are ignored here
      // so they don't bleed into the hero excerpt on the public page.
      for (const item of items.filter((it) => it.document_source)) {
        const rows = await sql`
          SELECT content FROM documents
          WHERE owner_id = ${ownerId} AND source = ${item.document_source} AND type = 'bio'
          ORDER BY created_at DESC LIMIT 1
        `
        if (rows[0]?.content) sections.push(rows[0].content as string)
      }

      // Composition refs — listed as a manifest of included sections
      const refs = items.filter((it) => it.ref_composition_id !== null)
      if (refs.length > 0) {
        const lines: string[] = ['## Sections']
        for (const ref of refs) {
          if (ref.ref_composition_id) {
            const comp = await getComposition(ref.ref_composition_id, ownerId)
            if (comp) lines.push(`- **${ref.section_label || comp.title}** (${comp.type})`)
          }
        }
        sections.push(lines.join('\n'))
      }

      if (sections.length > 0) {
        await ingestDocument(
          'folio',
          folioComp.title,
          'content/folio.md',
          sections.join('\n\n'),
          ownerId,
          ownerId,
          { published: true },
        )
      }
    }
  } catch (err) {
    console.error('[revalidate-folio] folio doc compile failed:', err)
  }

  revalidatePath(`/folio-ai/${session.user.folioSlug}`)
  return Response.json({ ok: true })
}
