'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AdminDocument, Folio } from '@/lib/folios'

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
}

export default function AdminDocumentsTable({
  documents,
  folios,
}: {
  documents: AdminDocument[]
  folios: Folio[]
}) {
  const [ownerId, setOwnerId] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = documents.filter((d) => {
    if (ownerId !== 'all' && d.owner_id !== ownerId) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !d.title.toLowerCase().includes(q) &&
        !d.source.toLowerCase().includes(q) &&
        !d.type.toLowerCase().includes(q) &&
        !d.owner_name.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const typeCounts = filtered.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All owners ({documents.length} docs)</option>
          {folios.map((f) => {
            const count = documents.filter((d) => d.owner_id === f.owner_id).length
            return (
              <option key={f.owner_id} value={f.owner_id}>
                {f.name} — {f.slug} ({count})
              </option>
            )
          })}
        </select>

        <input
          type="text"
          placeholder="Search title, source, type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 w-64"
        />

        {(ownerId !== 'all' || search) && (
          <button
            onClick={() => { setOwnerId('all'); setSearch('') }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-zinc-600">
          {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          {Object.keys(typeCounts).length > 0 && (
            <> · {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`).join(', ')}</>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Owner</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Type</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Title</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Source</th>
                <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Chunks</th>
                <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((doc, i) => {
                const colors = TYPE_COLORS[doc.type] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                const date = new Date(doc.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })
                return (
                  <tr key={i} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {doc.owner_slug ? (
                        <Link
                          href={`/folio-ai/${doc.owner_slug}/design`}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-medium"
                        >
                          {doc.owner_name}
                        </Link>
                      ) : (
                        <span className="text-zinc-500 text-xs">{doc.owner_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded border font-mono ${colors}`}>
                        {doc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-200 max-w-xs truncate" title={doc.title}>
                      {doc.title}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500 max-w-xs truncate" title={doc.source}>
                      {doc.source}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                      {doc.chunk_count}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs whitespace-nowrap">
                      {date}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                    {documents.length === 0 ? 'No documents in the database yet' : 'No documents match the current filter'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
