import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { sql } from '@/lib/db'
import ArtifactViewer from '@/components/ArtifactViewer'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ source?: string }>
}

export const metadata = {
  robots: 'noindex, nofollow',
}

export default async function DocViewerPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { source } = await searchParams

  if (!source) notFound()

  const [folio, session] = await Promise.all([getFolioBySlug(slug), auth()])
  if (!folio) notFound()
  if (!session?.user || session.user.id !== folio.owner_id) {
    redirect(`/folio-ai/${slug}`)
  }

  const rows = await sql`
    SELECT type, title, content FROM documents
    WHERE owner_id = ${folio.owner_id} AND source = ${source}
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
      isOwner={true}
      backHref={`/folio-ai/${slug}/design`}
      backLabel="Studio"
    />
  )
}
