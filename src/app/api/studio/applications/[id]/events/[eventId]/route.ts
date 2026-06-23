import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { updateEvent, deleteEvent, type EventType } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; eventId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { eventId } = await params
  const body = await req.json() as Partial<{
    event_type: EventType; title: string | null; notes: string; occurred_at: string | null
  }>
  const event = await updateEvent(eventId, session.user.id, body)
  if (!event) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ event })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { eventId } = await params
  const deleted = await deleteEvent(eventId, session.user.id)
  if (!deleted) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ ok: true })
}
