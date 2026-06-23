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

export async function POST() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}
