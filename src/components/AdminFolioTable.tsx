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
  image_gen_quota: number
  image_gen_used: number
}

function ResetButton({
  onClick,
  disabled,
  busy,
}: {
  onClick: () => void
  disabled: boolean
  busy: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500
        hover:border-amber-600 hover:text-amber-400 hover:bg-amber-950/20
        disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-zinc-700
        disabled:hover:text-zinc-500 disabled:hover:bg-transparent
        transition-colors whitespace-nowrap"
    >
      {busy ? '…' : 'Reset'}
    </button>
  )
}

export default function AdminFolioTable({ folios: initial }: { folios: Folio[] }) {
  const [folios, setFolios] = useState(initial)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [editingImgQuota, setEditingImgQuota] = useState<Record<string, string>>({})
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
      setFolios((prev) => prev.map((f) => (f.id === folioId ? { ...f, token_budget: value } : f)))
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
      setFolios((prev) => prev.map((f) => (f.id === folioId ? { ...f, tokens_used: 0 } : f)))
    }
    setSaving((s) => ({ ...s, [folioId]: false }))
  }

  async function saveImgQuota(folioId: string) {
    const raw = editingImgQuota[folioId]
    const value = parseInt(raw, 10)
    if (isNaN(value) || value < 0) return
    setSaving((s) => ({ ...s, [folioId]: true }))
    const res = await fetch('/api/folio-ai/admin/budget', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folioId, image_gen_quota: value }),
    })
    if (res.ok) {
      setFolios((prev) => prev.map((f) => (f.id === folioId ? { ...f, image_gen_quota: value } : f)))
      setEditingImgQuota((e) => { const next = { ...e }; delete next[folioId]; return next })
    }
    setSaving((s) => ({ ...s, [folioId]: false }))
  }

  async function resetImgUsed(folioId: string) {
    setSaving((s) => ({ ...s, [folioId]: true }))
    const res = await fetch('/api/folio-ai/admin/budget', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folioId, reset_img_used: true }),
    })
    if (res.ok) {
      setFolios((prev) => prev.map((f) => (f.id === folioId ? { ...f, image_gen_used: 0 } : f)))
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
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Tokens used</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Budget</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">%</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Img gen</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {folios.map((folio) => {
            const pct = folio.token_budget > 0
              ? Math.round((folio.tokens_used / folio.token_budget) * 100)
              : 0
            const isEditingBudget = folio.id in editing
            const isBusy = saving[folio.id] ?? false
            return (
              <tr key={folio.id} className="hover:bg-zinc-900/40 transition-colors">
                <td className="px-4 py-3 text-zinc-200 font-medium">{folio.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">{folio.slug}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{folio.email}</td>

                {/* Tokens used + reset */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`tabular-nums ${folio.tokens_used > 0 ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {(folio.tokens_used / 1000).toFixed(1)}k
                    </span>
                    <ResetButton
                      onClick={() => resetUsed(folio.id)}
                      disabled={folio.tokens_used === 0}
                      busy={isBusy}
                    />
                  </div>
                </td>

                {/* Token budget (click to edit) */}
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

                {/* Usage % */}
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-medium ${pct > 80 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {pct}%
                  </span>
                </td>

                {/* Image gen used/quota + reset */}
                <td className="px-4 py-3 text-right">
                  {folio.id in editingImgQuota ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min="0"
                        value={editingImgQuota[folio.id]}
                        onChange={(e) => setEditingImgQuota((prev) => ({ ...prev, [folio.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveImgQuota(folio.id)
                          if (e.key === 'Escape') setEditingImgQuota((prev) => { const n = { ...prev }; delete n[folio.id]; return n })
                        }}
                        autoFocus
                        className="w-14 text-right bg-zinc-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                      />
                      <button onClick={() => saveImgQuota(folio.id)} disabled={isBusy} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40">
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingImgQuota((prev) => ({ ...prev, [folio.id]: String(folio.image_gen_quota) }))}
                        className="text-zinc-500 hover:text-zinc-200 transition-colors tabular-nums text-xs"
                        title="Click to edit image gen quota"
                      >
                        <span className={folio.image_gen_used > 0 ? 'text-zinc-300' : 'text-zinc-600'}>
                          {folio.image_gen_used}
                        </span>
                        <span className="text-zinc-600">/{folio.image_gen_quota}</span>
                      </button>
                      <ResetButton
                        onClick={() => resetImgUsed(folio.id)}
                        disabled={folio.image_gen_used === 0}
                        busy={isBusy}
                      />
                    </div>
                  )}
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
              <td colSpan={8} className="px-4 py-8 text-center text-zinc-600">
                No folios yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
