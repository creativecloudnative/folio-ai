import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getApplication, updateApplication, deleteApplication, type ApplicationStatus } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  const application = await getApplication(id, session.user.id)
  if (!application) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ application })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  const body = await req.json() as Partial<{
    company: string; role: string; job_url: string | null
    resume_id: string | null; status: ApplicationStatus
    applied_at: string | null; notes: string
  }>
  const application = await updateApplication(id, session.user.id, body)
  if (!application) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ application })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  const deleted = await deleteApplication(id, session.user.id)
  if (!deleted) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ ok: true })
}
