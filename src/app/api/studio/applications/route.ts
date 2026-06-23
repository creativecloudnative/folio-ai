import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { listApplications, createApplication, type ApplicationStatus } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const applications = await listApplications(session.user.id)
  return Response.json({ applications })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const body = await req.json() as {
    company: string
    role: string
    job_url?: string
    resume_id?: string
    status?: ApplicationStatus
    applied_at?: string
    notes?: string
  }

  if (!body.company?.trim() || !body.role?.trim()) {
    return Response.json({ error: 'company and role are required' }, { status: 400 })
  }

  const application = await createApplication({
    ownerId:   session.user.id,
    company:   body.company.trim(),
    role:      body.role.trim(),
    jobUrl:    body.job_url?.trim() || null,
    resumeId:  body.resume_id || null,
    status:    body.status ?? 'applied',
    appliedAt: body.applied_at || null,
    notes:     body.notes?.trim() ?? '',
  })

  return Response.json({ application }, { status: 201 })
}
