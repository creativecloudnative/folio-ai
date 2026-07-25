import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { resolveStudioOwner } from '@/lib/studio-access'
import { sql } from '@/lib/db'
import ArtifactViewer from '@/components/ArtifactViewer'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ source?: string; tab?: string }>
}

export const metadata = {
  robots: 'noindex, nofollow',
}

export default async function DocViewerPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { source, tab } = await searchParams

  if (!source) notFound()

  const [folio, session] = await Promise.all([getFolioBySlug(slug), auth()])
  if (!folio) notFound()

  const isOwner = session?.user?.id === folio.owner_id
  // Owners and invited Studio collaborators can preview drafts; anonymous
  // public visitors only ever see published content — same rule the dedicated
  // case-studies/architecture viewer routes already apply.
  const canViewDraft = isOwner || !!(await resolveStudioOwner(slug, session))

  const rows = await sql`
    SELECT type, title, content FROM documents
    WHERE owner_id = ${folio.owner_id} AND source = ${source}
    ${canViewDraft ? sql`` : sql`AND metadata->>'published' = 'true'`}
    ORDER BY created_at ASC
  `
  if (rows.length === 0) notFound()

  const type = rows[0].type as string
  const title = rows[0].title as string
  const content = (rows as Array<{ content: string }>).map((r) => r.content).join('\n\n')

  return (
    <ArtifactViewer
      title={title}
      content={content}
      type={type}
      source={source}
      isOwner={isOwner}
      backHref={canViewDraft ? `/folio-ai/${slug}/design${tab ? `?tab=${tab}` : ''}` : `/folio-ai/${slug}`}
      backLabel={canViewDraft ? 'Studio' : folio.name}
    />
  )
}
