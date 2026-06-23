import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { updateEvent, deleteEvent, type EventType } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string; id: string; eventId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, eventId } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const body = await req.json() as Partial<{
    event_type: EventType; title: string | null; notes: string; occurred_at: string | null
  }>
  const event = await updateEvent(eventId, ownerId, body)
  if (!event) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ event })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { slug, eventId } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const deleted = await deleteEvent(eventId, ownerId)
  if (!deleted) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ ok: true })
}
