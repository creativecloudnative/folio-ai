'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type Doc = {
  type: string
  title: string
  source: string
  submitted_by: string | null
  chunk_count: number
  is_baseline: boolean
  is_published: boolean
  created_at: string
}

type DocType = 'bio' | 'resume' | 'case-study' | 'architecture' | 'journal' | 'memory' | 'job-req' | 'connection' | 'diagram' | 'adr'

const DOC_TYPES: DocType[] = ['bio', 'resume', 'case-study', 'architecture', 'journal', 'adr', 'diagram', 'memory', 'job-req', 'connection']

const TYPE_COLORS: Record<string, string> = {
  'bio':          'bg-sky-900/50 text-sky-300 border-sky-700/50',
  'resume':       'bg-violet-900/50 text-violet-300 border-violet-700/50',
  'case-study':   'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  'architecture': 'bg-indigo-900/50 text-indigo-300 border-indigo-700/50',
  'journal':      'bg-amber-900/50 text-amber-300 border-amber-700/50',
  'job-req':      'bg-rose-900/50 text-rose-300 border-rose-700/50',
  'memory':       'bg-pink-900/50 text-pink-300 border-pink-700/50',
  'connection':   'bg-teal-900/50 text-teal-300 border-teal-700/50',
  'diagram':      'bg-cyan-900/50 text-cyan-300 border-cyan-700/50',
  'adr':          'bg-orange-900/50 text-orange-300 border-orange-700/50',
  'folio':        'bg-indigo-900/50 text-indigo-300 border-indigo-700/50',
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: 'asc' | 'desc' }) {
  if (sortField !== field) return <span className="ml-1 text-zinc-700">↕</span>
  return <span className="ml-1 text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function TypeBadge({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded border font-mono ${colors}`}>
      {type}
    </span>
  )
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

type SortField = 'type' | 'title' | 'created_at' | 'chunk_count'

export default function DocumentsTable({ folioSlug }: { folioSlug?: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Upload form state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<DocType>('resume')
  const [isBaseline, setIsBaseline] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadMsg, setUploadMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/documents')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDocs(data.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleUpload() {
    if (!uploadFile) return
    setUploadState('uploading')
    setUploadMsg('')

    try {
      const name = uploadFile.name.toLowerCase()
      const isBinary = name.endsWith('.pdf') || name.endsWith('.docx')
      let content: string
      let fileType: 'text' | 'pdf' | 'docx'
      if (isBinary) {
        const buffer = await uploadFile.arrayBuffer()
        content = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        fileType = name.endsWith('.docx') ? 'docx' : 'pdf'
      } else {
        content = await uploadFile.text()
        fileType = 'text'
      }

      const res = await fetch('/api/studio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.name,
          content,
          fileType,
          type: uploadType,
          isBaseline: uploadType === 'resume' ? isBaseline : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)

      setUploadState('success')
      setUploadMsg(`"${uploadFile.name}" uploaded (${data.chunks} chunks)`)
      setUploadFile(null)
      setIsBaseline(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchDocs()
    } catch (err) {
      setUploadState('error')
      setUploadMsg(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function handleExportAll() {
    setExporting(true)
    try {
      const res = await fetch('/api/studio/export')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `folio-export-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleDownloadOne(source: string) {
    try {
      const res = await fetch(`/api/studio/export?source=${encodeURIComponent(source)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (source.split('/').pop() ?? 'document') + '.md'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  async function handlePublish(source: string, publish: boolean) {
    setPublishing(source)
    try {
      const res = await fetch(`/api/studio/documents?source=${encodeURIComponent(source)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: publish }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDocs((prev) =>
        prev.map((d) => (d.source === source ? { ...d, is_published: publish } : d)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(null)
    }
  }

  async function handleDelete(source: string) {
    if (confirmDelete !== source) {
      setConfirmDelete(source)
      return
    }
    setDeleting(source)
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/studio/documents?source=${encodeURIComponent(source)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDocs((prev) => prev.filter((d) => d.source !== source))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'created_at' ? 'desc' : 'asc')
    }
  }

  // Folio document — compiled output of the folio composition, pinned at top, non-deletable
  const folioDocs = docs.filter((d) => d.type === 'folio')
  const restDocs  = docs.filter((d) => d.type !== 'folio')

  const q = search.trim().toLowerCase()
  const filtered = restDocs.filter((d) =>
    !q || d.title.toLowerCase().includes(q) || d.source.toLowerCase().includes(q) || d.type.toLowerCase().includes(q)
  )
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortField === 'type')       cmp = a.type.localeCompare(b.type)
    if (sortField === 'title')      cmp = a.title.localeCompare(b.title)
    if (sortField === 'chunk_count') cmp = a.chunk_count - b.chunk_count
    if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return sortDir === 'asc' ? cmp : -cmp
  })

  const uploadForm = showUpload && (
    <div className="border-b border-zinc-700 bg-zinc-800/60 px-4 py-4">
      <div className="flex flex-wrap items-end gap-3 max-w-4xl">
        {/* File picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">File (.md, .txt, .pdf)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf,.docx"
            onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); setUploadState('idle'); setUploadMsg('') }}
            className="text-xs text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-zinc-600 file:text-xs file:bg-zinc-700 file:text-zinc-300 hover:file:border-indigo-500 hover:file:text-indigo-300 cursor-pointer"
          />
        </div>

        {/* Type selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Type</label>
          <select
            value={uploadType}
            onChange={(e) => { setUploadType(e.target.value as DocType); setIsBaseline(false) }}
            className="bg-zinc-700 border border-zinc-600 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Baseline checkbox — only when type = resume */}
        {uploadType === 'resume' && (
          <label className="flex items-center gap-2 cursor-pointer self-end pb-1.5">
            <input
              type="checkbox"
              checked={isBaseline}
              onChange={(e) => setIsBaseline(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-xs text-zinc-300">Set as baseline</span>
          </label>
        )}

        {/* Actions */}
        <div className="flex gap-2 self-end">
          <button
            onClick={handleUpload}
            disabled={!uploadFile || uploadState === 'uploading'}
            className="text-xs px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {uploadState === 'uploading' ? 'Uploading…' : 'Upload'}
          </button>
          <button
            onClick={() => { setShowUpload(false); setUploadFile(null); setUploadState('idle'); setUploadMsg('') }}
            className="text-xs px-3 py-1.5 text-zinc-400 hover:text-white border border-zinc-600 hover:border-zinc-400 rounded transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Status message */}
        {uploadMsg && (
          <span className={`text-xs self-end pb-1.5 ${uploadState === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
            {uploadMsg}
          </span>
        )}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
          Loading documents…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchDocs} className="text-xs text-zinc-400 hover:text-white underline">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700 shrink-0 flex-wrap">
        <span className="text-xs text-zinc-500 shrink-0">
          {q && sorted.length !== restDocs.length
            ? `${sorted.length} of ${docs.length} documents`
            : `${docs.length} document${docs.length !== 1 ? 's' : ''}`}
          {' · '}{docs.reduce((n, d) => n + d.chunk_count, 0)} chunks
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, source, type…"
          className="flex-1 min-w-[160px] max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleExportAll}
            disabled={exporting || docs.length === 0}
            className="text-xs px-3 py-1.5 rounded border border-zinc-600 text-zinc-400 hover:border-emerald-600 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Download all content as a ZIP of Markdown files"
          >
            {exporting ? 'Exporting…' : '↓ Export all'}
          </button>
          <button
            onClick={() => { setShowUpload((v) => !v); setUploadState('idle'); setUploadMsg('') }}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              showUpload
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/40'
                : 'border-zinc-600 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400'
            }`}
          >
            {showUpload ? 'Cancel' : '+ Upload'}
          </button>
        </div>
      </div>


      {/* Inline upload form */}
      {uploadForm}

      {/* Table or empty state */}
      {docs.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
          No documents yet. Use the Chat tab or upload a file above.
        </div>
      ) : (sorted.length === 0 && folioDocs.length === 0) ? (
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
          No documents match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-700 text-xs text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-zinc-200 transition-colors" onClick={() => toggleSort('type')}>
                  Type<SortIcon field="type" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-zinc-200 transition-colors" onClick={() => toggleSort('title')}>
                  Title<SortIcon field="title" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium text-center cursor-pointer select-none hover:text-zinc-200 transition-colors" onClick={() => toggleSort('chunk_count')}>
                  Chunks<SortIcon field="chunk_count" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3 font-medium text-center">Baseline</th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-zinc-200 transition-colors" onClick={() => toggleSort('created_at')}>
                  Added<SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {/* Folio intro docs — pinned, not deletable */}
              {folioDocs.map((doc) => {
                const date = new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <tr key={doc.source} className="bg-indigo-950/20 border-l-2 border-l-indigo-600/50 hover:bg-indigo-950/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <TypeBadge type={doc.type} />
                        <span className="text-[10px] text-indigo-400 font-mono">folio page</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-100 max-w-[200px] truncate" title={doc.title}>
                      {doc.title}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs max-w-[220px] truncate" title={doc.source}>
                      {doc.source}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-400">{doc.chunk_count}</td>
                    <td className="px-4 py-3 text-center" />
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{date}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end items-center">
                        {folioSlug && (
                          <a
                            href={`/folio-ai/${folioSlug}/doc?source=${encodeURIComponent(doc.source)}`}
                            className="text-xs px-3 py-1 rounded border border-transparent text-zinc-500 hover:text-indigo-400 hover:border-indigo-800 transition-colors"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => handleDownloadOne(doc.source)}
                          className="text-xs px-3 py-1 rounded border border-transparent text-zinc-500 hover:text-emerald-400 hover:border-emerald-800 transition-colors"
                          title="Download as Markdown"
                        >
                          ↓
                        </button>
                        <span className="text-xs px-3 py-1 text-zinc-700" title="Folio document is auto-generated — click Apply to folio in the Compositions tab to regenerate">
                          —
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {folioDocs.length > 0 && <tr className="h-0"><td colSpan={7} className="p-0 border-b-2 border-zinc-700/60" /></tr>}
              {sorted.map((doc) => {
                const isDeleting = deleting === doc.source
                const isConfirming = confirmDelete === doc.source
                const isPublishing = publishing === doc.source
                const date = new Date(doc.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })
                const isPublishable = doc.type === 'case-study' || doc.type === 'architecture'
                const liveHref = doc.type === 'case-study'
                  ? `/case-studies/${doc.source.replace('content/case-studies/', '').replace('.md', '')}`
                  : `/architecture/${doc.source.replace('content/architecture/', '').replace('.md', '')}`

                return (
                  <tr
                    key={doc.source}
                    className="hover:bg-zinc-800/40 transition-colors"
                    onClick={() => { if (isConfirming) setConfirmDelete(null) }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TypeBadge type={doc.type} />
                    </td>
                    <td className="px-4 py-3 text-zinc-100 max-w-[200px] truncate" title={doc.title}>
                      <span>{doc.title}</span>
                      {isPublishable && doc.is_published && (
                        <a
                          href={liveHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-800/60 transition-colors"
                          title="View live page"
                        >
                          live ↗
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs max-w-[220px] truncate" title={doc.source}>
                      {doc.source}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-400">
                      {doc.chunk_count}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {doc.is_baseline && (
                        <span title="Baseline resume">
                          <svg className="w-4 h-4 text-indigo-400 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {date}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end items-center">
                        {folioSlug && (
                          <a
                            href={`/folio-ai/${folioSlug}/doc?source=${encodeURIComponent(doc.source)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-3 py-1 rounded border border-transparent text-zinc-500 hover:text-indigo-400 hover:border-indigo-800 transition-colors"
                            title="View / Edit"
                          >
                            View
                          </a>
                        )}
                        {isPublishable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePublish(doc.source, !doc.is_published) }}
                            disabled={isPublishing}
                            className={`text-xs px-3 py-1 rounded border transition-colors ${
                              isPublishing
                                ? 'text-zinc-600 border-transparent cursor-not-allowed'
                                : doc.is_published
                                  ? 'text-amber-400 border-amber-800/50 hover:text-amber-300 hover:border-amber-700'
                                  : 'text-emerald-400 border-emerald-800/50 hover:text-emerald-300 hover:border-emerald-700'
                            }`}
                            title={doc.is_published ? 'Unpublish from portfolio' : 'Publish to portfolio'}
                          >
                            {isPublishing ? '…' : doc.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadOne(doc.source) }}
                          className="text-xs px-3 py-1 rounded border border-transparent text-zinc-500 hover:text-emerald-400 hover:border-emerald-800 transition-colors"
                          title="Download as Markdown"
                        >
                          ↓
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(doc.source) }}
                          disabled={isDeleting}
                          className={`text-xs px-3 py-1 rounded transition-colors ${
                            isDeleting
                              ? 'text-zinc-600 cursor-not-allowed'
                              : isConfirming
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-800'
                          }`}
                        >
                          {isDeleting ? 'Deleting…' : isConfirming ? 'Confirm delete' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-zinc-600">
            Click outside a confirm button to cancel deletion
          </p>
        </div>
      )}
    </div>
  )
}
