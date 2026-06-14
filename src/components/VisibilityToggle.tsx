'use client'

import { useState } from 'react'

type Props = {
  slug: string
  initialIsPublic: boolean
}

export default function VisibilityToggle({ slug, initialIsPublic }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = !isPublic
    try {
      const res = await fetch(`/api/folio-ai/${slug}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: next }),
      })
      if (res.ok) setIsPublic(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isPublic ? 'Visible to anyone — click to make private' : 'Only you can see this — click to make public'}
      className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${
        isPublic
          ? 'border-emerald-700/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40'
          : 'border-zinc-600 bg-zinc-900/60 text-zinc-400 hover:border-zinc-400'
      }`}
    >
      {loading ? '…' : isPublic ? '● Public' : '○ Private'}
    </button>
  )
}
