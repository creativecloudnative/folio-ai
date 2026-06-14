'use client'

import { useState } from 'react'
import Link from 'next/link'

type Folio = {
  id: string
  name: string
  slug: string
  email: string
  token_budget: number
  tokens_used: number
}

export default function AdminFolioTable({ folios: initial }: { folios: Folio[] }) {
  const [folios, setFolios] = useState(initial)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  async function saveBudget(folioId: string) {
    const raw = editing[folioId]
    const value = parseInt(raw, 10)
    if (isNaN(value) || value < 0) return
    setSaving((s) => ({ ...s, [folioId]: true }))
    const res = await fetch('/api/folio-ai/admin/budget', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folioId, token_budget: value }),
    })
    if (res.ok) {
      setFolios((prev) =>
        prev.map((f) => (f.id === folioId ? { ...f, token_budget: value } : f)),
      )
      setEditing((e) => { const next = { ...e }; delete next[folioId]; return next })
    }
    setSaving((s) => ({ ...s, [folioId]: false }))
  }

  async function resetUsed(folioId: string) {
    setSaving((s) => ({ ...s, [folioId]: true }))
    const res = await fetch('/api/folio-ai/admin/budget', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folioId, reset_used: true }),
    })
    if (res.ok) {
      setFolios((prev) =>
        prev.map((f) => (f.id === folioId ? { ...f, tokens_used: 0 } : f)),
      )
    }
    setSaving((s) => ({ ...s, [folioId]: false }))
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 border-b border-zinc-800">
          <tr>
            <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Name</th>
            <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Slug</th>
            <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Email</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Used</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Budget</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">%</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {folios.map((folio) => {
            const pct = folio.token_budget > 0
              ? Math.round((folio.tokens_used / folio.token_budget) * 100)
              : 0
            const isEditingBudget = folio.id in editing
            const isBusy = saving[folio.id]
            return (
              <tr key={folio.id} className="hover:bg-zinc-900/40 transition-colors">
                <td className="px-4 py-3 text-zinc-200 font-medium">{folio.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">{folio.slug}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{folio.email}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-zinc-300">{(folio.tokens_used / 1000).toFixed(1)}k</span>
                    <button
                      onClick={() => resetUsed(folio.id)}
                      disabled={isBusy || folio.tokens_used === 0}
                      title="Reset usage to 0"
                      className="text-zinc-600 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs ml-1"
                    >
                      ↺
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {isEditingBudget ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min="0"
                        value={editing[folio.id]}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [folio.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveBudget(folio.id)
                          if (e.key === 'Escape') setEditing((prev) => { const n = { ...prev }; delete n[folio.id]; return n })
                        }}
                        autoFocus
                        className="w-20 text-right bg-zinc-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                      />
                      <button
                        onClick={() => saveBudget(folio.id)}
                        disabled={isBusy}
                        className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditing((prev) => ({ ...prev, [folio.id]: String(folio.token_budget) }))}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors tabular-nums"
                      title="Click to edit budget"
                    >
                      {(folio.token_budget / 1000).toFixed(0)}k
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-medium ${pct > 80 ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {pct}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/folio-ai/${folio.slug}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            )
          })}
          {folios.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-zinc-600">
                No folios yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
