'use client'

import { useState } from 'react'

type Props = {
  folioSlug: string
  initialCalUsername: string | null
}

export default function IntegrationsTab({ folioSlug, initialCalUsername }: Props) {
  const [calUsername, setCalUsername] = useState(initialCalUsername ?? '')
  const [saved, setSaved] = useState(initialCalUsername ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isDirty = calUsername.trim() !== saved.trim()

  async function save() {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/folio-ai/${folioSlug}/integrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cal_username: calUsername.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      const next = data.cal_username ?? ''
      setCalUsername(next)
      setSaved(next)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const previewUrl = calUsername.trim()
    ? `https://cal.com/${calUsername.trim()}`
    : null

  return (
    <div className="p-6 max-w-xl space-y-5">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="mt-0.5 w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Cal.com</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">
              Connect your Cal.com account so visitors can book time with you directly from the chat.
              {!saved && (
                <span className="block mt-1 text-amber-400/80">
                  Scheduling is disabled until you add your Cal.com username.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Cal.com username</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600 select-none shrink-0">cal.com/</span>
              <input
                type="text"
                value={calUsername}
                onChange={e => { setCalUsername(e.target.value); setError(null); setSuccess(false) }}
                onKeyDown={e => e.key === 'Enter' && isDirty && save()}
                placeholder="your-username"
                className="flex-1 text-sm bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {previewUrl && (
            <p className="text-xs text-zinc-600">
              Booking page:{' '}
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {previewUrl}
              </a>
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={save}
              disabled={loading || !isDirty}
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            {success && <p className="text-xs text-emerald-400">Saved</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
