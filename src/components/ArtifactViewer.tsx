'use client'

import { useState, useCallback } from 'react'
import { Suspense, lazy } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const MermaidBlock = lazy(() => import('./MermaidBlock'))

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-3xl font-bold text-white mt-10 mb-4 leading-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold text-white mt-10 mb-3 pb-2 border-b border-zinc-700">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-zinc-200 mt-6 mb-2">{children}</h3>,
  p: ({ children }) => <p className="text-zinc-300 leading-relaxed mb-4">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-outside ml-5 space-y-1 mb-4 text-zinc-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-5 space-y-1 mb-4 text-zinc-300">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
  hr: () => <hr className="border-zinc-700 my-8" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-600 pl-4 italic text-zinc-400 my-4">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-indigo-400 hover:text-indigo-300 underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm border-collapse border border-zinc-700">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-800 text-zinc-300">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-zinc-700 text-zinc-400">{children}</tbody>,
  th: ({ children }) => <th className="px-4 py-2 text-left font-medium border-b border-zinc-700">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2">{children}</td>,
  pre: ({ children }) => (
    <pre className="bg-zinc-900 rounded-lg p-4 overflow-x-auto mb-4 border border-zinc-700 text-sm">{children}</pre>
  ),
  code: ({ className, children }) => {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1]
    if (lang === 'mermaid') {
      return (
        <Suspense fallback={<div className="text-xs text-zinc-500 py-4 text-center">Rendering diagram…</div>}>
          <MermaidBlock code={String(children).trim()} />
        </Suspense>
      )
    }
    return (
      <code className="font-mono text-sm bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-200">
        {children}
      </code>
    )
  },
}

function Preview({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  )
}

type Props = {
  title: string
  content: string
  type: string
  source: string
  isOwner: boolean
  backHref: string
  backLabel: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function ArtifactViewer({ title, content: initialContent, type, source, isOwner, backHref, backLabel }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialContent)
  const [savedContent, setSavedContent] = useState(initialContent)
  const [editTitle, setEditTitle] = useState(title)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')

  const save = useCallback(async () => {
    setSaveState('saving')
    setSaveError('')
    try {
      const res = await fetch(`/api/studio/documents/content?source=${encodeURIComponent(source)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, title: editTitle, type }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      setSavedContent(draft)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
      setSaveState('error')
    }
  }, [draft, editTitle, source, type])

  function discard() {
    setDraft(savedContent)
    setEditTitle(title)
    setEditing(false)
    setSaveState('idle')
    setSaveError('')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/60 px-6 py-4 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <a href={backHref} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
            ← {backLabel}
          </a>

          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          ) : (
            <h1 className="text-sm font-semibold text-zinc-200 truncate flex-1 min-w-0">{editTitle}</h1>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {saveState === 'error' && (
              <span className="text-xs text-red-400">{saveError}</span>
            )}
            {saveState === 'saved' && (
              <span className="text-xs text-emerald-400">Saved</span>
            )}
            {isOwner && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
              >
                Edit
              </button>
            )}
            {isOwner && editing && (
              <>
                <button
                  onClick={discard}
                  className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={save}
                  disabled={saveState === 'saving'}
                  className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      {editing ? (
        /* Split editor */
        <div className="flex h-[calc(100vh-57px)]">
          <div className="flex-1 flex flex-col border-r border-zinc-800 min-w-0">
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
              <span className="text-xs text-zinc-500 font-mono">Markdown</span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 bg-zinc-950 text-zinc-200 font-mono text-sm px-6 py-6 resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
            />
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 sticky top-0">
              <span className="text-xs text-zinc-500 font-mono">Preview</span>
            </div>
            <div className="px-8 py-8">
              <Preview content={draft} />
            </div>
          </div>
        </div>
      ) : (
        /* Read-only view */
        <main className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-xs font-mono text-indigo-400 mb-3 tracking-widest uppercase">{type}</p>
          <h1 className="text-4xl font-bold text-white mb-10 leading-tight">{editTitle}</h1>
          <Preview content={savedContent} />
        </main>
      )}
    </div>
  )
}
