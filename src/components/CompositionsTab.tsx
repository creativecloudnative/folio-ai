'use client'

import { useState, useEffect, useCallback } from 'react'

type CompositionType = { id: string; name: string; slug: string; built_in: boolean; folio_visible: boolean; position: number }
type Composition     = { id: string; type: string; title: string; slug: string; published: boolean; updated_at: string }
type CompositionItem = {
  id: string
  document_source: string | null
  ref_composition_id: string | null
  ref_composition_title: string | null
  document_title: string | null
  section_label: string
  position: number
}
type DocOption  = { source: string; title: string; type: string }

const TYPE_COLORS: Record<string, string> = {
  'case-study':   'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  'architecture': 'bg-indigo-900/50 text-indigo-300 border-indigo-700/50',
  'folio':        'bg-violet-900/50 text-violet-300 border-violet-700/50',
}
function typeBadge(slug: string) {
  return TYPE_COLORS[slug] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
}

// ─── Panel: Manage composition types ─────────────────────────────────────────
function TypesPanel({ onClose, onTypeCreated }: {
  onClose: () => void
  onTypeCreated: (type: CompositionType) => void
}) {
  const [types, setTypes]       = useState<CompositionType[]>([])
  const [newName, setNewName]   = useState('')
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch('/api/studio/composition-types')
      .then((r) => r.json())
      .then((d) => setTypes(d.types ?? []))
  }, [])

  async function addType() {
    if (!newName.trim()) return
    setError('')
    const res = await fetch('/api/studio/composition-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    setTypes((prev) => [...prev, data.type])
    onTypeCreated(data.type)   // propagate to parent immediately
    setNewName('')
    setAdding(false)
  }

  async function toggleVisible(t: CompositionType) {
    await fetch(`/api/studio/composition-types/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio_visible: !t.folio_visible }),
    })
    setTypes((prev) => prev.map((x) => x.id === t.id ? { ...x, folio_visible: !x.folio_visible } : x))
  }

  async function deleteType(t: CompositionType) {
    await fetch(`/api/studio/composition-types/${t.id}`, { method: 'DELETE' })
    setTypes((prev) => prev.filter((x) => x.id !== t.id))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700 shrink-0">
        <span className="text-sm font-medium text-zinc-200">Composition Types</span>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 max-w-lg">
        {types.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-3">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${typeBadge(t.slug)}`}>{t.slug}</span>
            <span className="text-sm text-zinc-200 flex-1">{t.name}</span>
            {t.built_in
              ? <span className="text-[10px] text-zinc-600">built-in</span>
              : <button onClick={() => deleteType(t)} className="text-zinc-600 hover:text-red-400 text-xs transition-colors">Delete</button>
            }
            {t.slug !== 'folio' && (
              <button
                onClick={() => toggleVisible(t)}
                title={t.folio_visible ? 'Hide from folio page' : 'Show on folio page'}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${t.folio_visible ? 'border-indigo-600 text-indigo-400' : 'border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400'}`}
              >
                {t.folio_visible ? '● folio' : '○ hidden'}
              </button>
            )}
          </div>
        ))}

        {adding ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addType(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Type name (e.g. Blog Posts)"
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button onClick={addType} className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors">Add</button>
            <button onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 border border-zinc-600 text-zinc-400 rounded hover:text-white transition-colors">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-xs py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:border-indigo-600 hover:text-indigo-400 transition-colors"
          >
            + New type
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-xs text-zinc-600 pt-2">
          Types marked <span className="text-indigo-400">● folio</span> appear as sections on your public folio page.
        </p>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────
export default function CompositionsTab({ folioSlug }: { folioSlug?: string }) {
  const [compositions, setCompositions]       = useState<Composition[]>([])
  const [compositionTypes, setCompositionTypes] = useState<CompositionType[]>([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState<string | null>(null)
  const [selected, setSelected]               = useState<Composition | null>(null)
  const [items, setItems]                     = useState<CompositionItem[]>([])
  const [itemsLoading, setItemsLoading]       = useState(false)
  const [docs, setDocs]                       = useState<DocOption[]>([])
  const [dirty, setDirty]                     = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [publishing, setPublishing]           = useState(false)
  const [publishError, setPublishError]       = useState('')
  const [publishedSource, setPublishedSource] = useState('')
  const [showTypes, setShowTypes]             = useState(false)

  // Create form
  const [creating, setCreating]     = useState(false)
  const [newTitle, setNewTitle]     = useState('')
  const [newType, setNewType]       = useState('architecture')
  const [createError, setCreateError] = useState('')

  // Section editor
  const [pendingSections, setPendingSections] = useState<string[]>([])
  const [addingSection, setAddingSection]     = useState(false)
  const [newSectionName, setNewSectionName]   = useState('')

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [cRes, tRes, dRes] = await Promise.all([
        fetch('/api/studio/compositions'),
        fetch('/api/studio/composition-types'),
        fetch('/api/studio/documents'),
      ])
      if (!cRes.ok) throw new Error(`HTTP ${cRes.status}`)
      const [cData, tData, dData] = await Promise.all([cRes.json(), tRes.json(), dRes.json()])
      setCompositions(cData.compositions ?? [])
      setCompositionTypes(tData.types ?? [])
      setDocs((dData.documents ?? []).map((d: DocOption) => ({ source: d.source, title: d.title, type: d.type })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAll() }, [fetchAll])

  async function loadItems(comp: Composition) {
    setSelected(comp)
    setItems([])
    setDirty(false)
    setPublishError('')
    setPublishedSource('')
    setPendingSections([])
    setAddingSection(false)
    setNewSectionName('')
    setItemsLoading(true)
    try {
      const res = await fetch(`/api/studio/compositions/${comp.id}/items`)
      if (res.ok) { const d = await res.json(); setItems(d.items) }
    } finally { setItemsLoading(false) }
  }

  async function createComposition() {
    if (!newTitle.trim()) { setCreateError('Title required'); return }
    setCreateError('')
    const res = await fetch('/api/studio/compositions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), type: newType }),
    })
    const data = await res.json()
    if (!res.ok) { setCreateError(data.error ?? 'Failed'); return }
    setCompositions((prev) => [data.composition, ...prev])
    setNewTitle('')
    setCreating(false)
    loadItems(data.composition)
    // Re-fetch silently so the new composition appears in ref pickers across the tab
    fetchAll(true)
  }

  async function deleteComposition(id: string) {
    await fetch(`/api/studio/compositions/${id}`, { method: 'DELETE' })
    setCompositions((prev) => prev.filter((c) => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function addDocumentItem(sectionLabel: string) {
    if (!selected) return
    setPendingSections((prev) => prev.filter((l) => l !== sectionLabel))
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      document_source: '',
      ref_composition_id: null,
      ref_composition_title: null,
      document_title: '',
      section_label: sectionLabel,
      position: prev.length,
    }])
    setDirty(true)
  }

  function addCompositionItem(sectionLabel: string) {
    if (!selected) return
    setPendingSections((prev) => prev.filter((l) => l !== sectionLabel))
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      document_source: null,
      ref_composition_id: '',
      ref_composition_title: '',
      document_title: null,
      section_label: sectionLabel,
      position: prev.length,
    }])
    setDirty(true)
  }

  function updateItem(idx: number, field: string, value: string) {
    setItems((prev) => {
      const next = [...prev]
      const item = { ...next[idx], [field]: value || null }
      if (field === 'document_source') {
        const doc = docs.find((d) => d.source === value)
        item.document_title = doc?.title ?? ''
        item.ref_composition_id = null
        item.ref_composition_title = null
      }
      if (field === 'ref_composition_id') {
        const comp = compositions.find((c) => c.id === value)
        item.ref_composition_title = comp?.title ?? ''
        item.document_source = null
        item.document_title = null
      }
      next[idx] = item as CompositionItem
      return next
    })
    setDirty(true)
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, position: i })))
    setDirty(true)
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const next = [...items]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setItems(next.map((it, i) => ({ ...it, position: i })))
    setDirty(true)
  }

  function getSectionLabels(): string[] {
    const seen = new Set<string>()
    const order: string[] = []
    for (const it of items) {
      if (!seen.has(it.section_label)) { seen.add(it.section_label); order.push(it.section_label) }
    }
    for (const l of pendingSections) {
      if (!seen.has(l)) order.push(l)
    }
    return order
  }

  function addSection(label: string) {
    const trimmed = label.trim()
    if (!trimmed) return
    if (!getSectionLabels().includes(trimmed)) {
      setPendingSections((prev) => [...prev, trimmed])
      setDirty(true)
    }
    setNewSectionName('')
    setAddingSection(false)
  }

  function renameSection(oldLabel: string, newLabel: string) {
    setItems((prev) => prev.map((it) =>
      it.section_label === oldLabel ? { ...it, section_label: newLabel } : it
    ))
    setPendingSections((prev) => prev.map((l) => l === oldLabel ? newLabel : l))
    setDirty(true)
  }

  function deleteSection(label: string) {
    setItems((prev) =>
      prev.filter((it) => it.section_label !== label).map((it, i) => ({ ...it, position: i }))
    )
    setPendingSections((prev) => prev.filter((l) => l !== label))
    setDirty(true)
  }

  function moveSectionDir(label: string, dir: -1 | 1) {
    const order = getSectionLabels()
    const idx = order.indexOf(label)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= order.length) return
    ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]
    const grouped: Record<string, CompositionItem[]> = {}
    for (const it of items) {
      if (!grouped[it.section_label]) grouped[it.section_label] = []
      grouped[it.section_label].push(it)
    }
    const newItems: CompositionItem[] = []
    for (const l of order) {
      if (grouped[l]) newItems.push(...grouped[l])
    }
    setItems(newItems.map((it, i) => ({ ...it, position: i })))
    setPendingSections(order.filter((l) => !grouped[l]))
    setDirty(true)
  }

  async function saveItems() {
    if (!selected) return
    setSaving(true)
    try {
      await fetch(`/api/studio/compositions/${selected.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Skip items where neither source nor ref has been selected yet
          items: items
            .filter((it) => it.document_source || it.ref_composition_id)
            .map((it, i) => ({
              document_source:    it.document_source   || null,
              ref_composition_id: it.ref_composition_id || null,
              section_label: it.section_label,
              position: i,
            })),
        }),
      })
      setDirty(false)
    } finally { setSaving(false) }
  }

  async function publish() {
    if (!selected) return
    if (dirty) await saveItems()
    setPublishing(true)
    setPublishError('')
    setPublishedSource('')
    try {
      if (selected.type === 'folio') {
        // Folio composition just needs revalidation — no AI compilation
        await fetch('/api/studio/revalidate-folio', { method: 'POST' })
        setSelected((prev) => prev ? { ...prev, published: true } : prev)
        setCompositions((prev) => prev.map((c) => c.id === selected.id ? { ...c, published: true } : c))
      } else {
        const res = await fetch(`/api/studio/compositions/${selected.id}/publish`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
        setPublishedSource(data.source)
        setSelected((prev) => prev ? { ...prev, published: true } : prev)
        setCompositions((prev) => prev.map((c) => c.id === selected.id ? { ...c, published: true } : c))
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed')
    } finally { setPublishing(false) }
  }

  const nonFolioCompositions = compositions.filter((c) => c.type !== 'folio' && c.id !== selected?.id)

  if (loading) return <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">Loading…</div>
  if (showTypes) return (
    <TypesPanel
      onClose={() => { setShowTypes(false); fetchAll(true) }}
      onTypeCreated={(type) => setCompositionTypes((prev) => [...prev, type])}
    />
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 shrink-0">
          <span className="text-xs text-zinc-500">{compositions.length} composition{compositions.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowTypes(true)}
              className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
              title="Manage types"
            >⚙</button>
            <button
              onClick={() => setCreating((v) => !v)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${creating ? 'border-indigo-500 text-indigo-400 bg-indigo-950/40' : 'border-zinc-600 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400'}`}
            >{creating ? 'Cancel' : '+ New'}</button>
          </div>
        </div>

        {creating && (
          <div className="border-b border-zinc-700 px-4 py-3 space-y-2 shrink-0">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createComposition() }}
              placeholder="Title"
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {compositionTypes.filter((t) => t.slug !== 'folio').map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </select>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <button onClick={createComposition} className="w-full text-xs py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Create</button>
          </div>
        )}

        {error && <div className="px-4 py-3 text-xs text-red-400">{error}</div>}

        {/* Folio composition — pinned at top */}
        {compositions.filter((c) => c.type === 'folio').map((comp) => (
          <div
            key={comp.id}
            onClick={() => loadItems(comp)}
            className={`shrink-0 border-b border-zinc-700 px-4 py-3 cursor-pointer transition-colors ${selected?.id === comp.id ? 'bg-violet-950/40' : 'hover:bg-zinc-800/30'}`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${typeBadge('folio')}`}>folio</span>
              <span className="text-xs text-zinc-300 flex-1 truncate">{comp.title}</span>
              <span className="text-[10px] text-zinc-600">page layout</span>
            </div>
          </div>
        ))}

        <ul className="flex-1 overflow-y-auto divide-y divide-zinc-800">
          {compositions.filter((c) => c.type !== 'folio').length === 0 && !creating && (
            <li className="px-4 py-8 text-xs text-zinc-600 text-center">No compositions yet</li>
          )}
          {compositions.filter((c) => c.type !== 'folio').map((comp) => (
            <li
              key={comp.id}
              onClick={() => loadItems(comp)}
              className={`group px-4 py-3 cursor-pointer transition-colors ${selected?.id === comp.id ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-200 truncate">{comp.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${typeBadge(comp.type)}`}>{comp.type}</span>
                    {comp.published && <span className="text-[10px] text-emerald-400">● live</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteComposition(comp.id) }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs transition-all shrink-0"
                >✕</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Main */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Select or create a composition
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-200">{selected.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${typeBadge(selected.type)}`}>{selected.type}</span>
            </div>
            <div className="flex items-center gap-2">
              {publishError && <span className="text-xs text-red-400">{publishError}</span>}
              {publishedSource && folioSlug && selected.type !== 'folio' && (
                <a
                  href={`/folio-ai/${folioSlug}/doc?source=${encodeURIComponent(publishedSource)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >View live ↗</a>
              )}
              {dirty && (
                <button onClick={saveItems} disabled={saving} className="text-xs px-3 py-1.5 rounded border border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-white disabled:opacity-40 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
              <button
                onClick={publish}
                disabled={publishing || items.length === 0}
                className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
              >
                {publishing
                  ? (selected.type === 'folio' ? 'Applying…' : 'Publishing…')
                  : selected.type === 'folio'
                    ? 'Apply to folio'
                    : selected.published ? 'Republish' : 'Publish'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {itemsLoading ? (
              <p className="text-xs text-zinc-500">Loading…</p>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {getSectionLabels().map((label, sectionIdx) => {
                  const sectionLabels = getSectionLabels()
                  const sectionItems = items
                    .map((it, idx) => ({ it, idx }))
                    .filter(({ it }) => it.section_label === label)
                  return (
                    <div key={label || `section-${sectionIdx}`} className="rounded-lg border border-zinc-700 bg-zinc-900/20 overflow-hidden">
                      {/* Section header */}
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button onClick={() => moveSectionDir(label, -1)} disabled={sectionIdx === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 text-[10px] leading-none">▲</button>
                          <button onClick={() => moveSectionDir(label, 1)} disabled={sectionIdx === sectionLabels.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 text-[10px] leading-none">▼</button>
                        </div>
                        <input
                          value={label}
                          onChange={(e) => renameSection(label, e.target.value)}
                          placeholder="Section name"
                          className="flex-1 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-indigo-500 px-1 py-0.5 text-xs font-semibold text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors"
                        />
                        <button onClick={() => deleteSection(label)} className="text-zinc-600 hover:text-red-400 text-xs transition-colors shrink-0" title="Delete section">✕</button>
                      </div>

                      {/* Items within this section */}
                      {sectionItems.length > 0 && (
                        <div className="divide-y divide-zinc-800/50">
                          {sectionItems.map(({ it, idx }) => (
                            <div key={it.id} className="flex items-center gap-2 px-4 py-3">
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button
                                  onClick={() => moveItem(idx, -1)}
                                  disabled={idx === 0 || items[idx - 1]?.section_label !== label}
                                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 text-[10px] leading-none"
                                >▲</button>
                                <button
                                  onClick={() => moveItem(idx, 1)}
                                  disabled={idx === items.length - 1 || items[idx + 1]?.section_label !== label}
                                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 text-[10px] leading-none"
                                >▼</button>
                              </div>
                              <div className="flex-1">
                                {it.ref_composition_id !== null ? (
                                  <select
                                    value={it.ref_composition_id ?? ''}
                                    onChange={(e) => updateItem(idx, 'ref_composition_id', e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="">— select a composition —</option>
                                    {nonFolioCompositions.map((c) => (
                                      <option key={c.id} value={c.id}>[{c.type}] {c.title}{c.published ? ' ●' : ''}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <select
                                    value={it.document_source ?? ''}
                                    onChange={(e) => updateItem(idx, 'document_source', e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="">— select a document —</option>
                                    {docs.map((d) => (
                                      <option key={d.source} value={d.source}>[{d.type}] {d.title}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              <button onClick={() => removeItem(idx)} className="text-zinc-600 hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Per-section add buttons */}
                      <div className="flex gap-2 px-4 py-3 border-t border-zinc-800/50">
                        <button
                          onClick={() => addDocumentItem(label)}
                          className="flex-1 text-xs py-1.5 rounded border border-dashed border-zinc-700 text-zinc-500 hover:border-indigo-600 hover:text-indigo-400 transition-colors"
                        >+ Document</button>
                        <button
                          onClick={() => addCompositionItem(label)}
                          className="flex-1 text-xs py-1.5 rounded border border-dashed border-zinc-700 text-zinc-500 hover:border-violet-600 hover:text-violet-400 transition-colors"
                        >+ Composition</button>
                      </div>
                    </div>
                  )
                })}

                {/* Add Section */}
                {addingSection ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addSection(newSectionName)
                        if (e.key === 'Escape') { setAddingSection(false); setNewSectionName('') }
                      }}
                      placeholder="Section name"
                      className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button onClick={() => addSection(newSectionName)} className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors">Add</button>
                    <button onClick={() => { setAddingSection(false); setNewSectionName('') }} className="text-xs px-3 py-1.5 border border-zinc-600 text-zinc-400 rounded hover:text-white transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingSection(true)}
                    className="w-full text-xs py-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:border-indigo-600 hover:text-indigo-400 transition-colors"
                  >+ Add Section</button>
                )}

                {items.length > 0 && selected.type !== 'folio' && (
                  <p className="text-xs text-zinc-600 pt-1">
                    Publishing compiles these sources into a single page via AI. Nested compositions embed their compiled content.
                  </p>
                )}
                {selected.type === 'folio' && (
                  <p className="text-xs text-zinc-600 pt-1">
                    The folio page will show these sections when published. Click &quot;Apply to folio&quot; to refresh your public folio page.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
