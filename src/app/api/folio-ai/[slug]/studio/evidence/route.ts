import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

const EVENT_ACTIVITY: Record<string, string> = {
  phone_screen: 'Phone Screen',    technical:    'Technical Interview',
  behavioral:   'Behavioral Interview', onsite:  'Onsite / Loop',
  offer:        'Offer Received',  followup:     'Follow-up',
  note:         'Note / Contact',
}

const EVENT_METHOD: Record<string, string> = {
  phone_screen: 'Phone',           technical:    'Video / Phone',
  behavioral:   'Video / Phone',   onsite:       'In Person / Virtual',
  offer:        'Phone / Email',   followup:     'Email / Phone',
  note:         'Various',
}

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return Response.json({ error: 'from and to required' }, { status: 400 })

  const appRows = await sql`
    SELECT applied_at::text AS date, company, role,
      'Application Submitted' AS activity, 'Online Portal' AS method,
      COALESCE(notes, '') AS notes
    FROM job_applications
    WHERE owner_id = ${ownerId} AND applied_at IS NOT NULL
      AND applied_at BETWEEN ${from}::date AND ${to}::date
  `

  const eventRows = await sql`
    SELECT COALESCE(e.occurred_at::text, e.created_at::date::text) AS date,
      a.company, a.role, e.event_type AS raw_activity,
      COALESCE(e.title, '') AS event_title, COALESCE(e.notes, '') AS notes
    FROM application_events e
    JOIN job_applications a ON a.id = e.application_id
    WHERE e.owner_id = ${ownerId}
      AND COALESCE(e.occurred_at, e.created_at::date) BETWEEN ${from}::date AND ${to}::date
  `

  const events = eventRows.map((r) => ({
    date:     r.date as string,
    company:  r.company as string,
    role:     r.role as string,
    activity: EVENT_ACTIVITY[r.raw_activity as string] ?? String(r.raw_activity),
    method:   EVENT_METHOD[r.raw_activity as string]   ?? 'Various',
    notes:    r.event_title ? `${r.event_title}${r.notes ? ' — ' + r.notes : ''}` : r.notes as string,
  }))

  const activities = [
    ...appRows.map((r) => ({ ...r } as Record<string, string>)),
    ...events,
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return Response.json({ activities, from, to })
}
