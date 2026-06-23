import { sql } from './db'

// ── Constants ──────────────────────────────────────────────────────────────────

export const APPLICATION_STATUSES = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied:      'Applied',
  screening:    'Screening',
  interviewing: 'Interviewing',
  offer:        'Offer',
  accepted:     'Accepted',
  rejected:     'Rejected',
  withdrawn:    'Withdrawn',
  ghosted:      'Ghosted',
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  applied:      'text-blue-400 border-blue-700 bg-blue-950/40',
  screening:    'text-cyan-400 border-cyan-700 bg-cyan-950/40',
  interviewing: 'text-indigo-400 border-indigo-700 bg-indigo-950/40',
  offer:        'text-amber-400 border-amber-700 bg-amber-950/40',
  accepted:     'text-green-400 border-green-700 bg-green-950/40',
  rejected:     'text-red-400 border-red-700 bg-red-950/40',
  withdrawn:    'text-zinc-400 border-zinc-700 bg-zinc-900/40',
  ghosted:      'text-zinc-500 border-zinc-800 bg-zinc-900/20',
}

export const EVENT_TYPES = [
  'note',
  'phone_screen',
  'technical',
  'behavioral',
  'onsite',
  'offer',
  'followup',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  note:         'Note',
  phone_screen: 'Phone Screen',
  technical:    'Technical Interview',
  behavioral:   'Behavioral Interview',
  onsite:       'Onsite / Loop',
  offer:        'Offer',
  followup:     'Follow-up',
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type JobApplication = {
  id: string
  owner_id: string
  company: string
  role: string
  job_url: string | null
  resume_id: string | null
  resume_title: string | null  // joined from resumes
  status: ApplicationStatus
  applied_at: string | null    // ISO date string
  notes: string
  created_at: string
  updated_at: string
}

export type ApplicationEvent = {
  id: string
  application_id: string
  owner_id: string
  event_type: EventType
  title: string | null
  notes: string
  occurred_at: string | null   // ISO date string
  created_at: string
  updated_at: string
}

// ── Applications CRUD ──────────────────────────────────────────────────────────

export async function listApplications(ownerId: string): Promise<JobApplication[]> {
  const rows = await sql`
    SELECT a.*, r.title AS resume_title
    FROM job_applications a
    LEFT JOIN resumes r ON r.id = a.resume_id
    WHERE a.owner_id = ${ownerId}
    ORDER BY a.updated_at DESC
  `
  return rows as unknown as JobApplication[]
}

export async function getApplication(id: string, ownerId: string): Promise<JobApplication | null> {
  const rows = await sql`
    SELECT a.*, r.title AS resume_title
    FROM job_applications a
    LEFT JOIN resumes r ON r.id = a.resume_id
    WHERE a.id = ${id} AND a.owner_id = ${ownerId}
  `
  return (rows[0] as unknown as JobApplication) ?? null
}

export async function createApplication(data: {
  ownerId: string
  company: string
  role: string
  jobUrl: string | null
  resumeId: string | null
  status: ApplicationStatus
  appliedAt: string | null
  notes: string
}): Promise<JobApplication> {
  const rows = await sql`
    INSERT INTO job_applications (owner_id, company, role, job_url, resume_id, status, applied_at, notes)
    VALUES (${data.ownerId}, ${data.company}, ${data.role}, ${data.jobUrl},
            ${data.resumeId}, ${data.status}, ${data.appliedAt}, ${data.notes})
    RETURNING *
  `
  return { ...(rows[0] as unknown as JobApplication), resume_title: null }
}

export async function updateApplication(
  id: string,
  ownerId: string,
  patch: Partial<{
    company: string
    role: string
    job_url: string | null
    resume_id: string | null
    status: ApplicationStatus
    applied_at: string | null
    notes: string
  }>,
): Promise<JobApplication | null> {
  const rows = await sql`
    UPDATE job_applications SET
      company   = COALESCE(${patch.company    ?? null}, company),
      role      = COALESCE(${patch.role       ?? null}, role),
      job_url   = CASE WHEN ${patch.job_url   !== undefined} THEN ${patch.job_url   ?? null} ELSE job_url END,
      resume_id = CASE WHEN ${patch.resume_id !== undefined} THEN ${patch.resume_id ?? null} ELSE resume_id END,
      status    = COALESCE(${patch.status     ?? null}, status),
      applied_at = CASE WHEN ${patch.applied_at !== undefined} THEN ${patch.applied_at ?? null} ELSE applied_at END,
      notes     = COALESCE(${patch.notes      ?? null}, notes),
      updated_at = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING *
  `
  if (!rows[0]) return null
  return { ...(rows[0] as unknown as JobApplication), resume_title: null }
}

export async function deleteApplication(id: string, ownerId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM job_applications WHERE id = ${id} AND owner_id = ${ownerId} RETURNING id
  `
  return rows.length > 0
}

// ── Application Events CRUD ────────────────────────────────────────────────────

export async function listEvents(applicationId: string, ownerId: string): Promise<ApplicationEvent[]> {
  const rows = await sql`
    SELECT * FROM application_events
    WHERE application_id = ${applicationId} AND owner_id = ${ownerId}
    ORDER BY COALESCE(occurred_at, created_at::date) DESC, created_at DESC
  `
  return rows as unknown as ApplicationEvent[]
}

export async function createEvent(data: {
  applicationId: string
  ownerId: string
  eventType: EventType
  title: string | null
  notes: string
  occurredAt: string | null
}): Promise<ApplicationEvent> {
  const rows = await sql`
    INSERT INTO application_events (application_id, owner_id, event_type, title, notes, occurred_at)
    VALUES (${data.applicationId}, ${data.ownerId}, ${data.eventType},
            ${data.title}, ${data.notes}, ${data.occurredAt})
    RETURNING *
  `
  // Touch the parent application's updated_at
  sql`UPDATE job_applications SET updated_at = NOW() WHERE id = ${data.applicationId}`.catch(() => {})
  return rows[0] as unknown as ApplicationEvent
}

export async function updateEvent(
  id: string,
  ownerId: string,
  patch: Partial<{ event_type: EventType; title: string | null; notes: string; occurred_at: string | null }>,
): Promise<ApplicationEvent | null> {
  const rows = await sql`
    UPDATE application_events SET
      event_type  = COALESCE(${patch.event_type ?? null}, event_type),
      title       = CASE WHEN ${patch.title !== undefined} THEN ${patch.title ?? null} ELSE title END,
      notes       = COALESCE(${patch.notes ?? null}, notes),
      occurred_at = CASE WHEN ${patch.occurred_at !== undefined} THEN ${patch.occurred_at ?? null} ELSE occurred_at END,
      updated_at  = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING *
  `
  return (rows[0] as unknown as ApplicationEvent) ?? null
}

export async function deleteEvent(id: string, ownerId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM application_events WHERE id = ${id} AND owner_id = ${ownerId} RETURNING id
  `
  return rows.length > 0
}

// ── Studio chat helpers ────────────────────────────────────────────────────────

export async function listApplicationsForChat(ownerId: string, status?: string): Promise<JobApplication[]> {
  if (status) {
    const rows = await sql`
      SELECT a.*, r.title AS resume_title
      FROM job_applications a
      LEFT JOIN resumes r ON r.id = a.resume_id
      WHERE a.owner_id = ${ownerId} AND a.status = ${status}
      ORDER BY a.updated_at DESC
    `
    return rows as unknown as JobApplication[]
  }
  return listApplications(ownerId)
}

export async function getApplicationWithEvents(
  id: string,
  ownerId: string,
): Promise<{ application: JobApplication; events: ApplicationEvent[] } | null> {
  const application = await getApplication(id, ownerId)
  if (!application) return null
  const events = await listEvents(id, ownerId)
  return { application, events }
}
