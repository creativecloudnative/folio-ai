'use client'

import { useState, useEffect, useCallback } from 'react'

export type StoredConversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
}

type Props = {
  onRestore: (conversation: StoredConversation) => void
}

export default function ConversationHistory({ onRestore }: Props) {
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/conversations')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConversations(data.conversations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchConversations() }, [fetchConversations])

  async function handleRestore(conv: StoredConversation) {
    setRestoring(conv.id)
    try {
      const res = await fetch(`/api/studio/conversations/${conv.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onRestore(data.conversation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setRestoring(null)
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      return
    }
    setDeleting(id)
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/studio/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
        Loading history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchConversations} className="text-xs text-zinc-400 hover:text-white underline">
          Retry
        </button>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
        No saved conversations yet. Start chatting and your sessions will appear here.
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      onClick={() => setConfirmDelete(null)}
    >
      <div className="px-4 py-3 border-b border-zinc-700 shrink-0">
        <span className="text-xs text-zinc-500">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </span>
      </div>

      <ul className="divide-y divide-zinc-800">
        {conversations.map((conv) => {
          const isDeleting = deleting === conv.id
          const isConfirming = confirmDelete === conv.id
          const isRestoring = restoring === conv.id

          const updatedDate = new Date(conv.updated_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })
          const updatedTime = new Date(conv.updated_at).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit',
          })

          return (
            <li
              key={conv.id}
              className="flex items-start gap-3 px-4 py-4 hover:bg-zinc-800/40 transition-colors group"
              onClick={(e) => {
                if (isConfirming) { e.stopPropagation(); setConfirmDelete(null) }
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-100 truncate">{conv.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{updatedDate} · {updatedTime}</p>
              </div>

              <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRestore(conv) }}
                  disabled={isRestoring || isDeleting}
                  className="text-xs px-3 py-1 rounded border border-zinc-600 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isRestoring ? 'Loading…' : 'Restore'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(conv.id) }}
                  disabled={isDeleting || isRestoring}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${
                    isDeleting
                      ? 'text-zinc-600 border-zinc-700 cursor-not-allowed'
                      : isConfirming
                        ? 'bg-red-600 hover:bg-red-500 text-white border-red-600'
                        : 'border-zinc-600 text-zinc-500 hover:border-red-800 hover:text-red-400'
                  }`}
                >
                  {isDeleting ? 'Deleting…' : isConfirming ? 'Confirm' : 'Delete'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
