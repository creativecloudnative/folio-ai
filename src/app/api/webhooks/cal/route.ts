import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Cal.com signs the raw body with HMAC-SHA256 using the webhook secret.
// Header format: X-Cal-Signature-256: sha256=<hex>
function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret || !header) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const received = header.startsWith('sha256=') ? header.slice(7) : header

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
  } catch {
    return false
  }
}

type CalAttendee = { name: string; email: string; timeZone?: string }

type CalPayload = {
  triggerEvent: string
  payload: {
    bookingId?: number
    uid?: string
    title?: string
    startTime?: string
    endTime?: string
    description?: string
    attendees?: CalAttendee[]
    organizer?: { name: string; email: string }
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-cal-signature-256')

  if (!verifySignature(rawBody, signature)) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: CalPayload
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { triggerEvent, payload } = event

  if (triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'BOOKING_CONFIRMED') {
    const attendee = payload.attendees?.[0]
    console.log('[folio-ai booking]', JSON.stringify({
      timestamp: new Date().toISOString(),
      event: triggerEvent,
      bookingId: payload.bookingId ?? payload.uid ?? null,
      title: payload.title ?? null,
      startTime: payload.startTime ?? null,
      endTime: payload.endTime ?? null,
      attendeeName: attendee?.name ?? null,
      attendeeEmail: attendee?.email ?? null,
      notes: payload.description ?? null,
    }))
  }

  // Acknowledge all events — Cal.com retries on non-2xx
  return Response.json({ ok: true })
}
