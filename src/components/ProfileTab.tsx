'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

type ImageGenBalance = {
  quota: number
  used: number
  remaining: number
  reset_at: string
}

type RefPhoto = { url: string; pathname: string }

type Style = 'professional' | 'bw' | 'illustrated'

const STYLES: { value: Style; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional',  description: 'Studio lighting, neutral background' },
  { value: 'bw',           label: 'Black & white', description: 'High contrast, classic look' },
  { value: 'illustrated',  label: 'Illustrated',   description: 'Clean vector avatar style' },
]

const OWNER_IMAGE_URL = '/api/studio/headshot/image'
const MAX_REFS = 4

export default function ProfileTab() {
  const [hasHeadshot, setHasHeadshot]   = useState(false)
  const [imageBust, setImageBust]       = useState(0)
  const [visible, setVisible]           = useState(false)
  const [balance, setBalance]           = useState<ImageGenBalance | null>(null)
  const [loading, setLoading]           = useState(true)
  const [selectedStyle, setSelectedStyle] = useState<Style>('professional')

  const [refs, setRefs]                 = useState<RefPhoto[]>([])
  const [refsLoading, setRefsLoading]   = useState(true)
  const [addingRef, setAddingRef]       = useState(false)
  const [removingRef, setRemovingRef]   = useState<string | null>(null)

  const [uploadBusy, setUploadBusy]     = useState(false)
  const [importBusy, setImportBusy]     = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [savingOption, setSavingOption] = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const fileRef    = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/studio/headshot')
      .then((r) => r.json())
      .then((data) => {
        setHasHeadshot(data.has_headshot ?? false)
        setVisible(data.headshot_visible ?? false)
        setBalance(data.imageGenBalance ?? null)
      })
      .finally(() => setLoading(false))

    fetch('/api/studio/headshot/references')
      .then((r) => r.json())
      .then((data) => setRefs(data.refs ?? []))
      .finally(() => setRefsLoading(false))
  }, [])

  async function toggleVisible() {
    const next = !visible
    setVisible(next)
    await fetch('/api/studio/headshot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headshot_visible: next }),
    })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploadBusy(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/studio/headshot/upload', { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok) {
      setHasHeadshot(true)
      setImageBust((n) => n + 1)
      setGeneratedUrl(null)
    } else {
      setError(data.error ?? 'Upload failed')
    }
    setUploadBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleImportLinkedIn() {
    setError(null)
    setImportBusy(true)
    const res = await fetch('/api/studio/headshot/import-linkedin', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setHasHeadshot(true)
      setImageBust((n) => n + 1)
      setGeneratedUrl(null)
    } else {
      setError(data.error ?? 'Import failed')
    }
    setImportBusy(false)
  }

  async function handleAddRef(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setAddingRef(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/studio/headshot/references', { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok) {
      setRefs((prev) => [...prev, { url: data.url, pathname: data.pathname }])
    } else {
      setError(data.error ?? 'Upload failed')
    }
    setAddingRef(false)
    if (refFileRef.current) refFileRef.current.value = ''
  }

  async function handleRemoveRef(ref: RefPhoto) {
    setRemovingRef(ref.url)
    const res = await fetch('/api/studio/headshot/references', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ref.url }),
    })
    if (res.ok) {
      setRefs((prev) => prev.filter((r) => r.url !== ref.url))
    }
    setRemovingRef(null)
  }

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    setGeneratedUrl(null)
    const res = await fetch('/api/studio/headshot/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style: selectedStyle, referenceUrls: refs.map((r) => r.url) }),
    })
    const data = await res.json()
    if (res.ok) {
      setGeneratedUrl(data.dataUrl ?? null)
      setBalance((prev) => prev ? { ...prev, remaining: data.remaining, used: prev.quota - data.remaining } : prev)
    } else {
      setError(data.error ?? 'Generation failed')
    }
    setGenerating(false)
  }

  async function saveGenerated() {
    if (!generatedUrl) return
    setSavingOption(true)
    setError(null)
    const res = await fetch('/api/studio/headshot/save-generated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: generatedUrl }),
    })
    const data = await res.json()
    if (res.ok) {
      setHasHeadshot(true)
      setImageBust((n) => n + 1)
      setGeneratedUrl(null)
    } else {
      setError(data.error ?? 'Save failed')
    }
    setSavingOption(false)
  }

  const resetDate = balance?.reset_at
    ? new Date(balance.reset_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const quotaExhausted = (balance?.remaining ?? 0) === 0

  if (loading) {
    return <div className="h-full flex items-center justify-center text-zinc-600 text-sm">Loading…</div>
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-xl space-y-8">

      {/* Current headshot + visibility */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300">Headshot</h3>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0 flex items-center justify-center">
            {hasHeadshot ? (
              <Image
                src={`${OWNER_IMAGE_URL}?v=${imageBust}`}
                alt="Headshot"
                width={80}
                height={80}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <span className="text-3xl text-zinc-600">👤</span>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              {hasHeadshot ? 'Your headshot is set.' : 'No headshot uploaded yet.'}
            </p>
            <button
              onClick={toggleVisible}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors ${
                visible
                  ? 'border-indigo-600/60 bg-indigo-950/30 text-indigo-400'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${visible ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
              {visible ? 'Visible on folio' : 'Hidden from folio'}
            </button>
          </div>
        </div>
      </section>

      {/* Set headshot */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">Set headshot</h3>
        <div className="flex gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadBusy}
            className="flex-1 px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40"
          >
            {uploadBusy ? 'Uploading…' : '↑ Upload image'}
          </button>
          <button
            onClick={handleImportLinkedIn}
            disabled={importBusy}
            className="flex-1 px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40"
          >
            {importBusy ? 'Importing…' : 'in Import from LinkedIn'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
        <p className="text-[11px] text-zinc-600">
          JPEG, PNG, or WebP — max 5 MB. Images are moderated before upload.
        </p>
      </section>

      {/* Reference photos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Reference photos</h3>
          <span className="text-[11px] text-zinc-600">{refs.length}/{MAX_REFS}</span>
        </div>
        <p className="text-xs text-zinc-500">
          Additional photos help the AI capture your likeness more accurately during generation.
        </p>

        {refsLoading ? (
          <p className="text-[11px] text-zinc-600">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {refs.map((ref) => (
              <div key={ref.url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 group shrink-0">
                <Image src={ref.url} alt="Reference photo" fill className="object-cover" unoptimized />
                <button
                  onClick={() => handleRemoveRef(ref)}
                  disabled={removingRef === ref.url}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-lg leading-none"
                  title="Remove"
                >
                  {removingRef === ref.url ? '…' : '×'}
                </button>
              </div>
            ))}
            {refs.length < MAX_REFS && (
              <button
                onClick={() => refFileRef.current?.click()}
                disabled={addingRef}
                className="w-16 h-16 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-600 hover:text-zinc-400 transition-colors flex items-center justify-center text-2xl disabled:opacity-40 shrink-0"
                title="Add reference photo"
              >
                {addingRef ? '…' : '+'}
              </button>
            )}
          </div>
        )}

        <input ref={refFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAddRef} />
      </section>

      {/* AI Generation */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">AI generation</h3>
          {balance && (
            <span className="text-[11px] text-zinc-500">
              {balance.remaining} of {balance.quota} remaining
              {resetDate && ` · resets ${resetDate}`}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Uses your headshot{refs.length > 0 ? ` and ${refs.length} reference photo${refs.length > 1 ? 's' : ''}` : ''} as input. Each generation costs 1 credit.
        </p>

        {/* Style selector */}
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSelectedStyle(s.value)}
              className={`px-3 py-2.5 rounded border text-left transition-colors ${
                selectedStyle === s.value
                  ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              <p className="text-xs font-medium">{s.label}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{s.description}</p>
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!hasHeadshot || generating || quotaExhausted}
          className="w-full px-4 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {generating ? 'Generating…' : 'Generate'}
        </button>

        {!hasHeadshot && (
          <p className="text-[11px] text-amber-500">Upload a headshot above before generating.</p>
        )}
        {quotaExhausted && (
          <p className="text-[11px] text-amber-500">
            Quota exhausted{resetDate ? ` — resets ${resetDate}` : ''}.
          </p>
        )}

        {/* Generated result */}
        {generatedUrl && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">Generated result:</p>
            <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-zinc-700">
              <Image src={generatedUrl} alt="Generated headshot" fill className="object-cover" unoptimized />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveGenerated}
                disabled={savingOption}
                className="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {savingOption ? 'Saving…' : 'Save as headshot'}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || quotaExhausted}
                className="px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 text-sm transition-colors disabled:opacity-40"
              >
                Regenerate
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
