import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { getApplication, listEvents } from '@/lib/job-applications'
import { listResumes } from '@/lib/resumes'
import ApplicationDetail from './ApplicationDetail'

export const dynamic = 'force-dynamic'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const [session, folio] = await Promise.all([auth(), getFolioBySlug(slug)])

  if (!folio) notFound()

  const isOwner      = !!session?.user && session.user.id === folio.owner_id
  const isFullAccess = !isOwner && folio.studio_full_access && folio.studio_is_public

  if (!isOwner && !isFullAccess) redirect(`/folio-ai/${slug}/design`)

  const ownerId = folio.owner_id

  const [application, events, resumes] = await Promise.all([
    getApplication(id, ownerId),
    listEvents(id, ownerId),
    listResumes(ownerId),
  ])

  if (!application) notFound()

  return (
    <ApplicationDetail
      application={application}
      initialEvents={events}
      resumes={resumes.map((r) => ({ id: r.id, title: r.title }))}
      folioSlug={slug}
      demoSlug={isFullAccess ? slug : undefined}
    />
  )
}
