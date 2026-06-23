import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { getApplication, updateApplication, deleteApplication, type ApplicationStatus } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string; id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const application = await getApplication(id, ownerId)
  if (!application) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ application })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const body = await req.json() as Partial<{
    company: string; role: string; job_url: string | null
    resume_id: string | null; status: ApplicationStatus
    applied_at: string | null; notes: string
  }>
  const application = await updateApplication(id, ownerId, body)
  if (!application) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ application })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const deleted = await deleteApplication(id, ownerId)
  if (!deleted) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ ok: true })
}
