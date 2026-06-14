'use client'

import { useState } from 'react'

type Props = {
  folioSlug: string
  initialIsPublic: boolean
}

export default function SharingTab({ folioSlug, initialIsPublic }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setVisibility(next: boolean) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/folio-ai/${folioSlug}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: next }),
      })
      if (!res.ok) throw new Error('Failed to update visibility')
      setIsPublic(next)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Folio visibility</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isPublic
                ? 'Your folio is public — anyone with the link can view it.'
                : 'Your folio is private — only you can view it when signed in.'}
            </p>
          </div>
          <span
            className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium ${
              isPublic
                ? 'border-emerald-700/60 bg-emerald-900/20 text-emerald-400'
                : 'border-zinc-600 bg-zinc-800 text-zinc-400'
            }`}
          >
            {isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {isPublic ? (
            <button
              onClick={() => setVisibility(false)}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-40 transition-colors"
            >
              {loading ? 'Saving…' : 'Make private'}
            </button>
          ) : (
            <button
              onClick={() => setVisibility(true)}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
            >
              {loading ? 'Saving…' : 'Make public'}
            </button>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </section>
    </div>
  )
}
