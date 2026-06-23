'use client'

import { useState, useEffect } from 'react'

type Activity = {
  date: string
  company: string
  role: string
  activity: string
  method: string
  notes: string
}

type Preset = 'week' | '2weeks' | 'month' | 'custom'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return mon
}

function presetRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date()
  if (preset === 'week') {
    return { from: isoDate(startOfWeek(today)), to: isoDate(today) }
  }
  if (preset === '2weeks') {
    const past = new Date(today)
    past.setDate(today.getDate() - 13)
    return { from: isoDate(past), to: isoDate(today) }
  }
  if (preset === 'month') {
    return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to: isoDate(today) }
  }
  return { from: customFrom, to: customTo }
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

export default function EvidenceTab({ demoSlug }: { demoSlug?: string }) {
  const apiBase = demoSlug ? `/api/folio-ai/${demoSlug}/studio` : '/api/studio'
  const [preset,        setPreset]        = useState<Preset>('2weeks')
  const [customFrom,    setCustomFrom]    = useState('')
  const [customTo,      setCustomTo]      = useState('')
  const [activities,    setActivities]    = useState<Activity[]>([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  // Stores the dates to fetch; set on preset change or "Generate" click
  const [fetchRange, setFetchRange] = useState<{ from: string; to: string } | null>(() =>
    presetRange('2weeks', '', ''),
  )

  function triggerFetch(p: Preset, cf: string, ct: string) {
    const range = presetRange(p, cf, ct)
    if (!range.from || !range.to || range.from > range.to) return
    setFetchRange({ ...range })
  }

  function handlePresetChange(p: Preset) {
    setPreset(p)
    if (p !== 'custom') triggerFetch(p, '', '')
  }

  useEffect(() => {
    if (!fetchRange) return
    const { from, to } = fetchRange
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${apiBase}/evidence?from=${from}&to=${to}`)
        if (cancelled) return
        if (!res.ok) { setError('Failed to load report'); return }
        const data = await res.json()
        if (!cancelled) setActivities(data.activities ?? [])
      } catch {
        if (!cancelled) setError('Failed to load report')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [fetchRange, apiBase])

  const from = fetchRange?.from ?? ''
  const to   = fetchRange?.to   ?? ''

  return (
    <div className="p-6 space-y-6">

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Date Range</div>
          <div className="flex gap-1">
            {([
              ['week',   'This Week'],
              ['2weeks', 'Last 2 Weeks'],
              ['month',  'This Month'],
              ['custom', 'Custom'],
            ] as [Preset, string][]).map(([p, label]) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  preset === p
                    ? 'border-indigo-600 text-indigo-400 bg-indigo-950/40'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <>
            <div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">From</div>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">To</div>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-600"
              />
            </div>
            <button
              onClick={() => triggerFetch('custom', customFrom, customTo)}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="px-3 py-1.5 text-xs rounded border border-indigo-700 text-indigo-400 hover:bg-indigo-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Generate
            </button>
          </>
        )}

        {/* Print — only shown when there are results */}
        {activities.length > 0 && (
          <button
            onClick={() => window.print()}
            className="ml-auto px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors print:hidden"
          >
            Print / Save PDF
          </button>
        )}
      </div>

      {/* Report */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-zinc-600">Loading…</p>
      ) : (
        <>
          {/* Print header — hidden on screen */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold text-zinc-900">Job Search Activity Log</h1>
            <p className="text-sm text-zinc-600 mt-1">
              Period: {formatDate(from)} – {formatDate(to)} &nbsp;·&nbsp; {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-x-auto print:border-none print:shadow-none">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 border-b border-zinc-800 print:bg-zinc-100">
                <tr>
                  {['Date', 'Company', 'Role', 'Activity', 'Method of Contact', 'Notes'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-zinc-500 font-medium whitespace-nowrap print:text-zinc-700 print:font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 print:divide-zinc-200">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-600 text-xs">
                      No job search activity recorded for this period.
                    </td>
                  </tr>
                ) : activities.map((a, i) => (
                  <tr key={i} className="hover:bg-zinc-900/40 transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-3 text-zinc-400 text-xs tabular-nums whitespace-nowrap print:text-zinc-800">{formatDate(a.date)}</td>
                    <td className="px-4 py-3 font-medium text-zinc-200 text-sm whitespace-nowrap print:text-zinc-900">{a.company}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs max-w-[160px] truncate print:text-zinc-700">{a.role}</td>
                    <td className="px-4 py-3 text-zinc-300 text-xs whitespace-nowrap print:text-zinc-800">{a.activity}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap print:text-zinc-700">{a.method}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[220px] print:text-zinc-600">
                      <span className="line-clamp-2">{a.notes || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activities.length > 0 && (
            <p className="text-[11px] text-zinc-600 print:text-zinc-500">
              {activities.length} activit{activities.length === 1 ? 'y' : 'ies'} from {formatDate(from)} to {formatDate(to)}
            </p>
          )}
        </>
      )}
    </div>
  )
}
