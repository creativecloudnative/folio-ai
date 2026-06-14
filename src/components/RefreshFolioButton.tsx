'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RefreshFolioButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    try {
      await fetch('/api/studio/revalidate-folio', { method: 'POST' })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={refresh}
      disabled={busy}
      title="Refresh folio page"
      className="text-xs px-2.5 py-1.5 rounded border border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
    >
      {busy ? '↻…' : '↻ Refresh'}
    </button>
  )
}
