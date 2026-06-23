import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { updateEvent, deleteEvent, type EventType } from '@/lib/job-applications'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string; id: string; eventId: string }> }

export async function PATCH() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}

export async function DELETE() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}
