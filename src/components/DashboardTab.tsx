'use client'

import { useState, useEffect } from 'react'
import { APPLICATION_STATUSES, STATUS_LABELS, STATUS_COLORS, type ApplicationStatus, type JobApplication } from '@/lib/job-applications'

const ACTIVE_STATUSES: ApplicationStatus[] = ['applied', 'screening', 'interviewing', 'offer']

type StatCard = { label: string; value: number | string; color: string; status?: ApplicationStatus }

export default function DashboardTab({ demoSlug }: { demoSlug?: string }) {
  const apiBase = demoSlug ? `/api/folio-ai/${demoSlug}/studio` : '/api/studio'
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const res = await fetch(`${apiBase}/applications`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setApplications(data.applications ?? [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [apiBase])

  const byStatus = APPLICATION_STATUSES.reduce<Record<ApplicationStatus, number>>(
    (acc, s) => { acc[s] = 0; return acc },
    {} as Record<ApplicationStatus, number>,
  )
  applications.forEach((a) => { byStatus[a.status] = (byStatus[a.status] ?? 0) + 1 })

  const activeTotal = ACTIVE_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0)

  const stats: StatCard[] = [
    { label: 'Active Pipeline', value: loading ? '—' : activeTotal, color: 'text-indigo-400' },
    { label: 'Interviewing',    value: loading ? '—' : byStatus.interviewing, color: 'text-indigo-300', status: 'interviewing' },
    { label: 'Offers',          value: loading ? '—' : byStatus.offer,        color: 'text-amber-400',  status: 'offer' },
    { label: 'Accepted',        value: loading ? '—' : byStatus.accepted,     color: 'text-green-400',  status: 'accepted' },
  ]

  const recent = [...applications]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5)

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Pipeline stats */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        {!loading && applications.length === 0 && (
          <p className="mt-3 text-xs text-zinc-600">No applications yet — add one in the Applications tab.</p>
        )}
      </section>

      {/* Status breakdown */}
      {!loading && applications.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">All Status Counts</h2>
          <div className="flex flex-wrap gap-2">
            {APPLICATION_STATUSES.map((s) => (
              byStatus[s] > 0 ? (
                <span key={s} className={`text-[11px] font-medium px-2 py-1 rounded border ${STATUS_COLORS[s]}`}>
                  {STATUS_LABELS[s]} ({byStatus[s]})
                </span>
              ) : null
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Recently Updated</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-800">
                {recent.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-200 text-sm">{a.company}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[160px] truncate">{a.role}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[a.status]}`}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs tabular-nums text-right">
                      {a.last_event_type ? (a.last_event_date ?? '') : (a.applied_at ?? '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Placeholder sections */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Coming Soon</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Agent Alerts',
              desc: 'Proactive notifications from your studio agent — follow-up reminders, stale applications, and action items surfaced automatically.',
            },
            {
              title: 'Calendar Events',
              desc: 'Upcoming interviews and meetings synced from Cal.com. Scheduled bookings from your public folio will appear here.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="rounded-xl border border-zinc-800/60 border-dashed bg-zinc-900/20 px-5 py-5">
              <div className="text-sm font-medium text-zinc-500 mb-1">{title}</div>
              <div className="text-xs text-zinc-600 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
