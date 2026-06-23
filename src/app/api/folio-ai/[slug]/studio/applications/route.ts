import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { listApplications, createApplication, type ApplicationStatus } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const applications = await listApplications(ownerId)
  return Response.json({ applications })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const body = await req.json() as {
    company: string; role: string; job_url?: string; resume_id?: string
    status?: ApplicationStatus; applied_at?: string; notes?: string
  }
  if (!body.company?.trim() || !body.role?.trim()) {
    return Response.json({ error: 'company and role are required' }, { status: 400 })
  }
  const application = await createApplication({
    ownerId,
    company: body.company.trim(),
    role: body.role.trim(),
    jobUrl: body.job_url?.trim() || null,
    resumeId: body.resume_id || null,
    status: body.status ?? 'applied',
    appliedAt: body.applied_at || null,
    notes: body.notes ?? '',
  })
  return Response.json({ application }, { status: 201 })
}
