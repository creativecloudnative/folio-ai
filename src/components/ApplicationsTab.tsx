'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  APPLICATION_STATUSES, STATUS_LABELS, STATUS_COLORS, EVENT_TYPE_LABELS,
  type ApplicationStatus, type JobApplication, type EventType,
} from '@/lib/job-applications'

type ResumeOption = { id: string; title: string }

type SortCol = 'company' | 'role' | 'status' | 'applied_at' | 'last_event_type' | 'last_event_date'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM = {
  company: '', role: '', job_url: '', resume_id: '',
  status: 'applied' as ApplicationStatus, applied_at: '', notes: '',
}

function sortApplications(list: JobApplication[], col: SortCol, dir: SortDir): JobApplication[] {
  return [...list].sort((a, b) => {
    let av: string = '', bv: string = ''
    if (col === 'company')         { av = a.company.toLowerCase();                     bv = b.company.toLowerCase() }
    else if (col === 'role')       { av = a.role.toLowerCase();                        bv = b.role.toLowerCase() }
    else if (col === 'status')     { av = a.status;                                    bv = b.status }
    else if (col === 'applied_at') { av = a.applied_at ?? '';                          bv = b.applied_at ?? '' }
    else if (col === 'last_event_type') { av = a.last_event_type ?? '';               bv = b.last_event_type ?? '' }
    else if (col === 'last_event_date') { av = a.last_event_date ?? '';               bv = b.last_event_date ?? '' }
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

export default function ApplicationsTab({ demoSlug }: { demoSlug?: string }) {
  const params = useParams<{ slug: string }>()
  const folioSlug = params?.slug ?? ''
  const apiBase = demoSlug ? `/api/folio-ai/${demoSlug}/studio` : '/api/studio'

  const [applications, setApplications] = useState<JobApplication[]>([])
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all')
  const [sortCol, setSortCol] = useState<SortCol>('last_event_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [appsRes, resumesRes] = await Promise.all([
          fetch(`${apiBase}/applications`),
          fetch(`${apiBase}/resumes`),
        ])
        if (appsRes.ok && !cancelled) {
          const data = await appsRes.json()
          setApplications(data.applications ?? [])
        }
        if (resumesRes.ok && !cancelled) {
          const data = await resumesRes.json()
          setResumes((data.resumes ?? []).map((r: { id: string; title: string }) => ({ id: r.id, title: r.title })))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [apiBase])

  function field(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleAdd() {
    if (!form.company.trim() || !form.role.trim()) {
      setFormError('Company and role are required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch(`${apiBase}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company:    form.company.trim(),
          role:       form.role.trim(),
          job_url:    form.job_url.trim() || undefined,
          resume_id:  form.resume_id || undefined,
          status:     form.status,
          applied_at: form.applied_at || undefined,
          notes:      form.notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Failed to save'); return }
      setApplications((prev) => [data.application, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, company: string, role: string) {
    if (!confirm(`Delete application for ${role} at ${company}?`)) return
    const res = await fetch(`${apiBase}/applications/${id}`, { method: 'DELETE' })
    if (res.ok) setApplications((prev) => prev.filter((a) => a.id !== id))
  }

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = sortApplications(
    filterStatus === 'all' ? applications : applications.filter((a) => a.status === filterStatus),
    sortCol, sortDir,
  )

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Job Applications</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{applications.length} total</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ApplicationStatus | 'all')}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              onClick={() => { setShowForm((v) => !v); setFormError('') }}
              className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              {showForm ? '✕ Cancel' : '+ Add Application'}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-4">
            <p className="text-sm font-medium text-zinc-200">New application</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Company *</label>
                <input value={form.company} onChange={(e) => field('company', e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Role *</label>
                <input value={form.role} onChange={(e) => field('role', e.target.value)}
                  placeholder="Senior Software Engineer"
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Status</label>
                <select value={form.status} onChange={(e) => field('status', e.target.value)}
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500">
                  {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Applied date</label>
                <input type="date" value={form.applied_at} onChange={(e) => field('applied_at', e.target.value)}
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Resume used</label>
                <select value={form.resume_id} onChange={(e) => field('resume_id', e.target.value)}
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500">
                  <option value="">— none —</option>
                  {resumes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Job posting URL</label>
                <input value={form.job_url} onChange={(e) => field('job_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Notes</label>
              <textarea value={form.notes} onChange={(e) => field('notes', e.target.value)}
                rows={3} placeholder="Initial thoughts, referral source, recruiter name…"
                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-y" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleAdd} disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {saving ? 'Saving…' : 'Add Application'}
              </button>
              {formError && <p className="text-xs text-red-400">{formError}</p>}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 border-b border-zinc-800">
              <tr>
                {(
                  [
                    ['company',         'Company'],
                    ['role',            'Role'],
                    ['status',          'Status'],
                    ['applied_at',      'Applied'],
                    ['last_event_type', 'Last Step'],
                    ['last_event_date', 'Last Activity'],
                  ] as [SortCol, string][]
                ).map(([col, label]) => (
                  <th key={col}
                    onClick={() => handleSort(col)}
                    className="text-left px-4 py-3 text-xs text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap transition-colors"
                  >
                    {label}
                    {sortCol === col && (
                      <span className="ml-1 text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Resume</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-600 text-xs">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-zinc-600 text-xs">
                  {filterStatus === 'all' ? 'No applications yet — add one above.' : `No ${STATUS_LABELS[filterStatus as ApplicationStatus]} applications.`}
                </td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-200 text-sm whitespace-nowrap">{a.company}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs max-w-[180px] truncate">{a.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs tabular-nums whitespace-nowrap">{formatDate(a.applied_at)}</td>
                  <td className="px-4 py-3">
                    {a.last_event_type
                      ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 whitespace-nowrap">
                          {EVENT_TYPE_LABELS[a.last_event_type as EventType]}
                        </span>
                      : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs tabular-nums whitespace-nowrap">{formatDate(a.last_event_date)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs max-w-[140px] truncate">{a.resume_title ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <Link href={`/folio-ai/${folioSlug}/design/application/${a.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                        View
                      </Link>
                      <button onClick={() => handleDelete(a.id, a.company, a.role)}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
