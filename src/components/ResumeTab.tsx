'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { RESUME_TEMPLATES, type ResumeTemplate } from '@/lib/resumes'

type ResumeRow = {
  id: string
  title: string
  company: string | null
  role: string | null
  template: ResumeTemplate
  updated_at: string
}

const TEMPLATES = Object.entries(RESUME_TEMPLATES) as [ResumeTemplate, { label: string; description: string }][]

export default function ResumeTab() {
  const params = useParams<{ slug: string }>()
  const folioSlug = params?.slug ?? ''

  const [resumes, setResumes] = useState<ResumeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [jobDescription, setJobDescription] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [template, setTemplate] = useState<ResumeTemplate>('modern')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const descRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const res = await fetch('/api/studio/resumes')
        if (res.ok && !cancelled) {
          const data = await res.json()
          setResumes(data.resumes ?? [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  async function handleFetchUrl() {
    if (!jobUrl.trim()) return
    setFetching(true)
    setFetchError('')
    try {
      const res = await fetch('/api/studio/resumes/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setFetchError(data.error ?? 'Failed to fetch URL'); return }
      setJobDescription(data.text)
      setTimeout(() => descRef.current?.focus(), 50)
    } finally {
      setFetching(false)
    }
  }

  async function handleGenerate() {
    if (!jobDescription.trim() && !jobUrl.trim()) {
      setGenError('Paste a job description or enter a URL.')
      return
    }
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch('/api/studio/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: jobDescription.trim() || undefined,
          job_url: jobUrl.trim() || undefined,
          template,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setGenError(data.error ?? 'Generation failed'); return }
      // Navigate to the viewer/editor
      window.location.href = `/folio-ai/${folioSlug}/design/resume/${data.resume.id}`
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/studio/resumes/${id}`, { method: 'DELETE' })
    if (res.ok) setResumes((prev) => prev.filter((r) => r.id !== id))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Resumes</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{resumes.length} saved</p>
          </div>
          <button
            onClick={() => { setShowCreate((v) => !v); setGenError(''); setFetchError('') }}
            className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            {showCreate ? '✕ Cancel' : '+ New Resume'}
          </button>
        </div>

        {/* Create panel */}
        {showCreate && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-5">
            <p className="text-sm font-medium text-zinc-200">Generate a tailored resume</p>

            {/* Job description / URL input */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Job description</label>
              <textarea
                ref={descRef}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={8}
                placeholder="Paste the full job posting here…"
                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-y"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">or fetch from URL</span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="https://jobs.example.com/..."
                    className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl() }}
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={fetching || !jobUrl.trim()}
                    className="text-xs px-3 py-1.5 rounded border border-zinc-600 text-zinc-400 hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {fetching ? 'Fetching…' : 'Fetch'}
                  </button>
                </div>
              </div>
              {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}
            </div>

            {/* Template picker */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Template</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEMPLATES.map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setTemplate(key)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      template === key
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    <p className="text-xs font-medium">{meta.label}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{meta.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleGenerate}
                disabled={generating || (!jobDescription.trim() && !jobUrl.trim())}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                {generating && (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {generating ? 'Generating…' : 'Generate Resume'}
              </button>
              {generating && (
                <p className="text-xs text-zinc-500">Retrieving portfolio context and generating — ~10–20s</p>
              )}
              {genError && <p className="text-xs text-red-400">{genError}</p>}
            </div>
          </div>
        )}

        {/* Resumes table */}
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Title</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Company</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Role</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Template</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600 text-xs">Loading…</td>
                </tr>
              ) : resumes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-600 text-xs">
                    No resumes yet — generate one above.
                  </td>
                </tr>
              ) : resumes.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 text-zinc-200 font-medium text-sm max-w-[200px] truncate">
                    {r.title}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{r.company ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{r.role ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                      {RESUME_TEMPLATES[r.template]?.label ?? r.template}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs tabular-nums">{formatDate(r.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <Link
                        href={`/folio-ai/${folioSlug}/design/resume/${r.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(r.id, r.title)}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                      >
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
