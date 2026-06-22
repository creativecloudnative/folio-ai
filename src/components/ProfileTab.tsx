'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

type ImageGenBalance = {
  quota: number
  used: number
  remaining: number
  reset_at: string
}

// Proxy URL for the owner's headshot — never exposes the raw Blob URL to the client
const OWNER_IMAGE_URL = '/api/studio/headshot/image'

export default function ProfileTab() {
  const [hasHeadshot, setHasHeadshot] = useState(false)
  // Cache-bust key so the <img> reloads after upload/import without a page refresh
  const [imageBust, setImageBust] = useState(0)
  const [visible, setVisible] = useState(false)
  const [balance, setBalance] = useState<ImageGenBalance | null>(null)
  const [loading, setLoading] = useState(true)

  const [uploadBusy, setUploadBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedOptions, setGeneratedOptions] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [savingOption, setSavingOption] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/studio/headshot')
      .then((r) => r.json())
      .then((data) => {
        setHasHeadshot(data.has_headshot ?? false)
        setVisible(data.headshot_visible ?? false)
        setBalance(data.imageGenBalance ?? null)
      })
      .finally(() => setLoading(false))
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
      setGeneratedOptions([])
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
      setGeneratedOptions([])
    } else {
      setError(data.error ?? 'Import failed')
    }
    setImportBusy(false)
  }

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    setGeneratedOptions([])
    setSelectedOption(null)
    const res = await fetch('/api/studio/headshot/generate', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setGeneratedOptions(data.urls ?? [])
      setBalance((prev) => prev ? { ...prev, remaining: data.remaining, used: prev.quota - data.remaining } : prev)
    } else {
      setError(data.error ?? 'Generation failed')
    }
    setGenerating(false)
  }

  async function saveOption(dataUrl: string) {
    setSavingOption(true)
    setError(null)
    const res = await fetch('/api/studio/headshot/save-generated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    })
    const data = await res.json()
    if (res.ok) {
      setHasHeadshot(true)
      setImageBust((n) => n + 1)
      setGeneratedOptions([])
      setSelectedOption(null)
    } else {
      setError(data.error ?? 'Save failed')
    }
    setSavingOption(false)
  }

  const resetDate = balance?.reset_at
    ? new Date(balance.reset_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
        Loading…
      </div>
    )
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
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleUpload}
        />
        <p className="text-[11px] text-zinc-600">
          JPEG, PNG, WebP, or GIF — max 5 MB. LinkedIn import uses your current profile picture.
        </p>
      </section>

      {/* AI Generation */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Generate professional headshot</h3>
          {balance && (
            <span className="text-[11px] text-zinc-500">
              {balance.remaining} of {balance.quota} remaining
              {resetDate && ` · resets ${resetDate}`}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Uses your current headshot as a base. Generates 3 professional options — you pick one to save.
        </p>

        <button
          onClick={handleGenerate}
          disabled={!hasHeadshot || generating || (balance?.remaining ?? 0) === 0}
          className="w-full px-4 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {generating ? 'Generating 3 options…' : 'Generate 3 options'}
        </button>

        {!hasHeadshot && (
          <p className="text-[11px] text-amber-500">Upload a headshot above before generating.</p>
        )}
        {balance?.remaining === 0 && (
          <p className="text-[11px] text-amber-500">
            Quota exhausted{resetDate ? ` — resets ${resetDate}` : ''}.
          </p>
        )}

        {/* Generated options */}
        {generatedOptions.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">Select an option to save it as your headshot:</p>
            <div className="grid grid-cols-3 gap-3">
              {generatedOptions.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setSelectedOption(i)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                    selectedOption === i
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  <Image src={url} alt={`Option ${i + 1}`} fill className="object-cover" unoptimized />
                  {selectedOption === i && (
                    <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                      <span className="text-white text-lg">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {selectedOption !== null && (
              <button
                onClick={() => saveOption(generatedOptions[selectedOption])}
                disabled={savingOption}
                className="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {savingOption ? 'Saving…' : 'Save as headshot'}
              </button>
            )}
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
