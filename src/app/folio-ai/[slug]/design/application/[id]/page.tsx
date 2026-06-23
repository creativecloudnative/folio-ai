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
  if (!session?.user || session.user.id !== folio.owner_id) {
    redirect(`/folio-ai/${slug}/design`)
  }

  const [application, events, resumes] = await Promise.all([
    getApplication(id, session.user.id),
    listEvents(id, session.user.id),
    listResumes(session.user.id),
  ])

  if (!application) notFound()

  return (
    <ApplicationDetail
      application={application}
      initialEvents={events}
      resumes={resumes.map((r) => ({ id: r.id, title: r.title }))}
      folioSlug={slug}
    />
  )
}
