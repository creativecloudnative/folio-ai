'use client'

import { useState } from 'react'
import type { FolioVideo } from '@/lib/videos'

type Props = {
  folioSlug: string
  initialVideos: FolioVideo[]
  isViewer?: boolean
}

export default function VideosTab({ folioSlug, initialVideos, isViewer = false }: Props) {
  const [videos, setVideos] = useState<FolioVideo[]>(initialVideos)
  const [url, setUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function addVideo() {
    if (!url.trim()) return
    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/folio-ai/${folioSlug}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add video')
      setVideos(prev => [...prev, data.video])
      setUrl('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setAddLoading(false)
    }
  }

  async function saveDescription(id: string) {
    setSavingId(id)
    try {
      await fetch(`/api/folio-ai/${folioSlug}/videos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, description: editDesc.trim() || null }),
      })
      setVideos(prev => prev.map(v => v.id === id ? { ...v, description: editDesc.trim() || null } : v))
      setEditingId(null)
    } finally {
      setSavingId(null)
    }
  }

  async function removeVideo(id: string) {
    setRemovingId(id)
    try {
      await fetch(`/api/folio-ai/${folioSlug}/videos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setVideos(prev => prev.filter(v => v.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">

      {/* Add video */}
      {!isViewer && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Add a video</h2>
          <p className="text-sm text-zinc-400 leading-relaxed mb-5">
            Paste a YouTube URL and we&apos;ll pull the title and thumbnail automatically.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setAddError(null) }}
              onKeyDown={e => e.key === 'Enter' && !addLoading && addVideo()}
              placeholder="https://www.youtube.com/watch?v=…"
              className="flex-1 text-sm bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={addVideo}
              disabled={addLoading || !url.trim()}
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-40 transition-colors shrink-0"
            >
              {addLoading ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
        </section>
      )}

      {/* Video list */}
      {videos.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">Your videos ({videos.length})</h2>
          {videos.map(video => (
            <div key={video.id} className="flex gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/60">
              {/* Thumbnail */}
              <a
                href={`https://www.youtube.com/watch?v=${video.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-32 h-20 object-cover rounded-md border border-zinc-700"
                />
              </a>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white leading-snug truncate">{video.title}</p>
                <p className="text-xs font-mono text-zinc-600 mt-0.5">{video.video_id}</p>

                {!isViewer && editingId === video.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={2}
                      placeholder="Short description shown on your folio (optional)"
                      className="w-full text-xs bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveDescription(video.id)}
                        disabled={savingId === video.id}
                        className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
                      >
                        {savingId === video.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs px-3 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-3">
                    <p className="text-xs text-zinc-500 truncate flex-1">
                      {video.description ?? <span className="italic text-zinc-600">No description</span>}
                    </p>
                    {!isViewer && (
                      <button
                        onClick={() => { setEditingId(video.id); setEditDesc(video.description ?? '') }}
                        className="text-xs text-zinc-600 hover:text-indigo-400 transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Remove */}
              {!isViewer && (
                <button
                  onClick={() => removeVideo(video.id)}
                  disabled={removingId === video.id}
                  className="shrink-0 text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors self-start mt-0.5"
                  aria-label="Remove video"
                >
                  {removingId === video.id ? '…' : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {videos.length === 0 && (
        <p className="text-xs text-zinc-600 px-1">No videos added yet.</p>
      )}
    </div>
  )
}
