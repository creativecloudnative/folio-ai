import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { listEvents, createEvent, type EventType } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  const events = await listEvents(id, session.user.id)
  return Response.json({ events })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  const body = await req.json() as {
    event_type?: EventType
    title?: string
    notes?: string
    occurred_at?: string
  }
  const event = await createEvent({
    applicationId: id,
    ownerId:       session.user.id,
    eventType:     body.event_type ?? 'note',
    title:         body.title?.trim() || null,
    notes:         body.notes?.trim() ?? '',
    occurredAt:    body.occurred_at || null,
  })
  return Response.json({ event }, { status: 201 })
}
