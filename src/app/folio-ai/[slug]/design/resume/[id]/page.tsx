import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { getResume } from '@/lib/resumes'
import ResumeEditor from './ResumeEditor'

export const dynamic = 'force-dynamic'

export default async function ResumeViewerPage({
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

  const resume = await getResume(id, session.user.id)
  if (!resume) notFound()

  return <ResumeEditor resume={resume} folioSlug={slug} />
}
