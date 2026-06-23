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

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const body = await req.json() as {
    event_type?: EventType; title?: string; notes?: string; occurred_at?: string
  }
  const event = await createEvent({
    applicationId: id,
    ownerId,
    eventType: body.event_type ?? 'note',
    title: body.title?.trim() || null,
    notes: body.notes ?? '',
    occurredAt: body.occurred_at || null,
  })
  return Response.json({ event }, { status: 201 })
}
