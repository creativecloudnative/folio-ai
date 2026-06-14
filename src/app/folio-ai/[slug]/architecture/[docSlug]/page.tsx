import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { sql } from '@/lib/db'
import ArtifactViewer from '@/components/ArtifactViewer'

type Props = { params: Promise<{ slug: string; docSlug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug, docSlug } = await params
  const folio = await getFolioBySlug(slug)
  if (!folio) return {}
  const rows = await sql`
    SELECT title FROM documents
    WHERE owner_id = ${folio.owner_id}
      AND source = ${'content/architecture/' + docSlug + '.md'}
      AND metadata->>'published' = 'true'
    LIMIT 1
  `
  if (rows.length === 0) return {}
  return { title: `${rows[0].title as string} — ${folio.name}` }
}

export default async function ArchitectureArtifactPage({ params }: Props) {
  const { slug, docSlug } = await params
  const [folio, session] = await Promise.all([getFolioBySlug(slug), auth()])
  if (!folio) notFound()

  const source = `content/architecture/${docSlug}.md`
  const isOwner = session?.user?.id === folio.owner_id

  // Owners can view unpublished drafts; visitors only see published
  const rows = await sql`
    SELECT title, content FROM documents
    WHERE owner_id = ${folio.owner_id}
      AND source = ${source}
      ${isOwner ? sql`` : sql`AND metadata->>'published' = 'true'`}
    ORDER BY created_at ASC
  `
  if (rows.length === 0) notFound()

  const title = rows[0].title as string
  const content = (rows as Array<{ content: string }>).map((r) => r.content).join('\n\n')

  return (
    <ArtifactViewer
      title={title}
      content={content}
      type="architecture"
      source={source}
      isOwner={isOwner}
      backHref={`/folio-ai/${slug}`}
      backLabel={folio.name}
    />
  )
}
