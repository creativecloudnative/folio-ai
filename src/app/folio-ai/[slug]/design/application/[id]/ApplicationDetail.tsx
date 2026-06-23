'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  APPLICATION_STATUSES, STATUS_LABELS, STATUS_COLORS,
  EVENT_TYPES, EVENT_TYPE_LABELS,
  type JobApplication, type ApplicationEvent, type ApplicationStatus, type EventType,
} from '@/lib/job-applications'

type ResumeOption = { id: string; title: string }

type Props = {
  application: JobApplication
  initialEvents: ApplicationEvent[]
  resumes: ResumeOption[]
  folioSlug: string
  demoSlug?: string
}

const EMPTY_EVENT = { event_type: 'note' as EventType, title: '', notes: '', occurred_at: '' }

export default function ApplicationDetail({ application: initial, initialEvents, resumes, folioSlug, demoSlug }: Props) {
  const apiBase = demoSlug ? `/api/folio-ai/${demoSlug}/studio` : '/api/studio'
  const router = useRouter()
  const [app, setApp] = useState(initial)
  const [events, setEvents] = useState<ApplicationEvent[]>(initialEvents)
  const [editingApp, setEditingApp] = useState(false)
  const [appDraft, setAppDraft] = useState({
    company: initial.company, role: initial.role,
    job_url: initial.job_url ?? '', resume_id: initial.resume_id ?? '',
    status: initial.status, applied_at: initial.applied_at ?? '', notes: initial.notes,
  })
  const [savingApp, setSavingApp] = useState(false)

  // New event form
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT)
  const [savingEvent, setSavingEvent] = useState(false)
  const [eventError, setEventError] = useState('')

  // Inline event editing
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [eventDraft, setEventDraft] = useState<typeof EMPTY_EVENT>(EMPTY_EVENT)

  // ── App save ────────────────────────────────────────────────────────────────

  async function saveApp() {
    setSavingApp(true)
    try {
      const res = await fetch(`${apiBase}/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company:    appDraft.company.trim(),
          role:       appDraft.role.trim(),
          job_url:    appDraft.job_url.trim() || null,
          resume_id:  appDraft.resume_id || null,
          status:     appDraft.status,
          applied_at: appDraft.applied_at || null,
          notes:      appDraft.notes.trim(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setApp({ ...data.application, resume_title: resumes.find((r) => r.id === appDraft.resume_id)?.title ?? null })
        setEditingApp(false)
      }
    } finally {
      setSavingApp(false)
    }
  }

  // ── Event create ─────────────────────────────────────────────────────────────

  async function addEvent() {
    if (!eventForm.notes.trim()) { setEventError('Notes are required.'); return }
    setSavingEvent(true)
    setEventError('')
    try {
      const res = await fetch(`${apiBase}/applications/${app.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type:  eventForm.event_type,
          title:       eventForm.title.trim() || undefined,
          notes:       eventForm.notes.trim(),
          occurred_at: eventForm.occurred_at || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEventError(data.error ?? 'Failed to save'); return }
      setEvents((prev) => [data.event, ...prev])
      setEventForm(EMPTY_EVENT)
      setShowEventForm(false)
    } finally {
      setSavingEvent(false)
    }
  }

  // ── Event edit ───────────────────────────────────────────────────────────────

  function startEditEvent(e: ApplicationEvent) {
    setEditingEventId(e.id)
    setEventDraft({
      event_type:  e.event_type,
      title:       e.title ?? '',
      notes:       e.notes,
      occurred_at: e.occurred_at ?? '',
    })
  }

  async function saveEvent(id: string) {
    const res = await fetch(`${apiBase}/applications/${app.id}/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type:  eventDraft.event_type,
        title:       eventDraft.title.trim() || null,
        notes:       eventDraft.notes.trim(),
        occurred_at: eventDraft.occurred_at || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setEvents((prev) => prev.map((e) => e.id === id ? data.event : e))
      setEditingEventId(null)
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this entry?')) return
    const res = await fetch(`${apiBase}/applications/${app.id}/events/${id}`, { method: 'DELETE' })
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  function formatDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const inputCls = 'w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500'

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">

      {/* Toolbar */}
      <header className="shrink-0 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => router.push(`/folio-ai/${folioSlug}/design?tab=applications`)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Applications
        </button>
        <span className="text-zinc-700">|</span>
        <span className="text-sm font-medium text-zinc-200 truncate">{app.role} @ {app.company}</span>
        <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[app.status]}`}>
          {STATUS_LABELS[app.status]}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!editingApp && (
            <button onClick={() => setEditingApp(true)}
              className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
              Edit
            </button>
          )}
          {app.job_url && (
            <a href={app.job_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Job posting ↗
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">

          {/* Application meta — view or edit */}
          {editingApp ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-4">
              <p className="text-sm font-medium text-zinc-200">Edit application</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Company</label>
                  <input value={appDraft.company} onChange={(e) => setAppDraft((d) => ({ ...d, company: e.target.value }))} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Role</label>
                  <input value={appDraft.role} onChange={(e) => setAppDraft((d) => ({ ...d, role: e.target.value }))} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Status</label>
                  <select value={appDraft.status} onChange={(e) => setAppDraft((d) => ({ ...d, status: e.target.value as ApplicationStatus }))}
                    className={inputCls}>
                    {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Applied date</label>
                  <input type="date" value={appDraft.applied_at} onChange={(e) => setAppDraft((d) => ({ ...d, applied_at: e.target.value }))} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Resume used</label>
                  <select value={appDraft.resume_id} onChange={(e) => setAppDraft((d) => ({ ...d, resume_id: e.target.value }))} className={inputCls}>
                    <option value="">— none —</option>
                    {resumes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Job URL</label>
                  <input value={appDraft.job_url} onChange={(e) => setAppDraft((d) => ({ ...d, job_url: e.target.value }))} placeholder="https://..." className={inputCls} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Notes</label>
                <textarea value={appDraft.notes} onChange={(e) => setAppDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={3} className={`${inputCls} resize-y`} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveApp} disabled={savingApp}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                  {savingApp ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingApp(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div><dt className="text-zinc-500 mb-0.5">Applied</dt><dd className="text-zinc-200">{formatDate(app.applied_at) ?? '—'}</dd></div>
                <div><dt className="text-zinc-500 mb-0.5">Status</dt>
                  <dd><span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[app.status]}`}>{STATUS_LABELS[app.status]}</span></dd>
                </div>
                <div><dt className="text-zinc-500 mb-0.5">Resume</dt>
                  <dd className="text-zinc-200 truncate">
                    {app.resume_id
                      ? <Link href={`/folio-ai/${folioSlug}/design/resume/${app.resume_id}`} className="text-indigo-400 hover:text-indigo-300">{app.resume_title ?? 'View →'}</Link>
                      : '—'}
                  </dd>
                </div>
                {app.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-zinc-500 mb-0.5">Notes</dt>
                    <dd className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{app.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Timeline</h3>
              <button onClick={() => { setShowEventForm((v) => !v); setEventError('') }}
                className="text-xs px-2.5 py-1 rounded border border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-indigo-300 transition-colors">
                {showEventForm ? '✕ Cancel' : '+ Add entry'}
              </button>
            </div>

            {/* New event form */}
            {showEventForm && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Type</label>
                    <select value={eventForm.event_type}
                      onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value as EventType }))}
                      className={inputCls}>
                      {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Title (optional)</label>
                    <input value={eventForm.title}
                      onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Round 1 with hiring manager"
                      className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Date</label>
                    <input type="date" value={eventForm.occurred_at}
                      onChange={(e) => setEventForm((f) => ({ ...f, occurred_at: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Notes *</label>
                  <textarea value={eventForm.notes}
                    onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={4} placeholder="What happened? Key takeaways, questions asked, next steps…"
                    className={`${inputCls} resize-y`} />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={addEvent} disabled={savingEvent}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                    {savingEvent ? 'Saving…' : 'Add entry'}
                  </button>
                  {eventError && <p className="text-xs text-red-400">{eventError}</p>}
                </div>
              </div>
            )}

            {/* Event list */}
            {events.length === 0 && !showEventForm && (
              <p className="text-xs text-zinc-600 py-4 text-center">No timeline entries yet — add phone screens, interviews, notes, and more.</p>
            )}
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  {editingEventId === e.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400">Type</label>
                          <select value={eventDraft.event_type}
                            onChange={(ev) => setEventDraft((d) => ({ ...d, event_type: ev.target.value as EventType }))}
                            className={inputCls}>
                            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400">Title</label>
                          <input value={eventDraft.title}
                            onChange={(ev) => setEventDraft((d) => ({ ...d, title: ev.target.value }))}
                            className={inputCls} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400">Date</label>
                          <input type="date" value={eventDraft.occurred_at}
                            onChange={(ev) => setEventDraft((d) => ({ ...d, occurred_at: ev.target.value }))}
                            className={inputCls} />
                        </div>
                      </div>
                      <textarea value={eventDraft.notes}
                        onChange={(ev) => setEventDraft((d) => ({ ...d, notes: ev.target.value }))}
                        rows={4} className={`${inputCls} resize-y`} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEvent(e.id)}
                          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">Save</button>
                        <button onClick={() => setEditingEventId(null)}
                          className="px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 text-xs hover:text-zinc-200 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                            {EVENT_TYPE_LABELS[e.event_type]}
                          </span>
                          {e.title && <span className="text-xs font-medium text-zinc-200">{e.title}</span>}
                          {e.occurred_at && (
                            <span className="text-xs text-zinc-500 tabular-nums">{formatDate(e.occurred_at)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => startEditEvent(e)}
                            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">Edit</button>
                          <button onClick={() => deleteEvent(e.id)}
                            className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Delete</button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{e.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
