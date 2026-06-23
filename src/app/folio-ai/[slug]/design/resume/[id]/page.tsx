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

  const isOwner      = !!session?.user && session.user.id === folio.owner_id
  const isFullAccess = !isOwner && folio.studio_full_access && folio.studio_is_public

  if (!isOwner && !isFullAccess) redirect(`/folio-ai/${slug}/design`)

  const resume = await getResume(id, folio.owner_id)
  if (!resume) notFound()

  return <ResumeEditor resume={resume} folioSlug={slug} demoSlug={isFullAccess ? slug : undefined} />
}
