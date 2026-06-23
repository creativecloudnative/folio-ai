import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { listEvents, createEvent, type EventType } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string; id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const events = await listEvents(id, ownerId)
  return Response.json({ events })
}

export async function POST() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}
