'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackFileExplorer,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react'
import { zincSandpackTheme } from '@/lib/sandpackTheme'
import {
  extractCodeDemoSpec, buildCodeDemoMarkdown,
  DEFAULT_CODE_DEMO_SPEC, DEFAULT_PYTHON_SPEC, PYTHON_ENTRY,
  type CodeDemoSpec,
} from '@/lib/codeDemo'
import PythonDemoBlock from './PythonDemoBlock'

type Demo = { source: string; title: string; created_at: string }

// Bridges Sandpack's internal (uncontrolled) editor state out to the Save button —
// Sandpack owns file edits internally, so we mirror the live file map into a ref on every change.
function FilesBridge({ filesRef }: { filesRef: React.MutableRefObject<Record<string, string>> }) {
  const { sandpack } = useSandpack()
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const [path, file] of Object.entries(sandpack.files)) next[path] = file.code
    filesRef.current = next
  }, [sandpack.files, filesRef])
  return null
}

export default function CodeDemosTab({ folioSlug, isViewer = false }: { folioSlug?: string; isViewer?: boolean }) {
  const apiBase = isViewer && folioSlug ? `/api/folio-ai/${folioSlug}/studio` : '/api/studio'

  const [demos, setDemos]         = useState<Demo[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Demo | null>(null)
  const [spec, setSpec]           = useState<CodeDemoSpec | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError]   = useState('')

  const [creating, setCreating]     = useState(false)
  const [newTitle, setNewTitle]     = useState('')
  const [newTemplate, setNewTemplate] = useState<'react' | 'python'>('react')
  const [createError, setCreateError] = useState('')

  const [pythonCode, setPythonCode] = useState('')
  const [pythonDeps, setPythonDeps] = useState<Record<string, string> | undefined>(undefined)

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const filesRef = useRef<Record<string, string>>({})

  const fetchDemos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/documents`)
      const data = await res.json()
      const rows = (data.documents ?? []) as Array<{ type: string; title: string; source: string; created_at: string }>
      setDemos(rows.filter((d) => d.type === 'code-demo').map((d) => ({ source: d.source, title: d.title, created_at: d.created_at })))
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchDemos() }, [fetchDemos])

  async function loadDemo(demo: Demo) {
    setSelected(demo)
    setSpec(null)
    setDocError('')
    setSaveState('idle')
    setDocLoading(true)
    try {
      const res = await fetch(`${apiBase}/documents/content?source=${encodeURIComponent(demo.source)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEditTitle(data.title)
      const parsed = extractCodeDemoSpec(data.content as string)
      if (!parsed) throw new Error('Could not parse code-demo content')
      setSpec(parsed)
      setPythonCode(parsed.files[PYTHON_ENTRY] ?? Object.values(parsed.files)[0] ?? '')
      setPythonDeps(parsed.dependencies)
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setDocLoading(false)
    }
  }

  async function createDemo() {
    const title = newTitle.trim()
    if (!title) { setCreateError('Title required'); return }
    setCreateError('')
    const defaultSpec = newTemplate === 'python' ? DEFAULT_PYTHON_SPEC : DEFAULT_CODE_DEMO_SPEC
    const content = buildCodeDemoMarkdown(title, defaultSpec)
    const res = await fetch('/api/studio/documents/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type: 'code-demo', content }),
    })
    const data = await res.json()
    if (!res.ok) { setCreateError(data.error ?? 'Failed to create'); return }
    const demo: Demo = { source: data.source, title: data.title, created_at: new Date().toISOString() }
    setDemos((prev) => [demo, ...prev])
    setNewTitle('')
    setCreating(false)
    setSelected(demo)
    setEditTitle(demo.title)
    setSpec(defaultSpec)
    setPythonCode(defaultSpec.files[PYTHON_ENTRY] ?? '')
    setPythonDeps(defaultSpec.dependencies)
  }

  async function deleteDemo(demo: Demo) {
    await fetch(`/api/studio/documents?source=${encodeURIComponent(demo.source)}`, { method: 'DELETE' })
    setDemos((prev) => prev.filter((d) => d.source !== demo.source))
    if (selected?.source === demo.source) {
      setSelected(null)
      setSpec(null)
    }
  }

  async function save() {
    if (!selected || !spec) return
    setSaveState('saving')
    setSaveError('')
    try {
      const nextSpec: CodeDemoSpec = spec.template === 'python'
        ? { ...spec, files: { [PYTHON_ENTRY]: pythonCode }, dependencies: pythonDeps }
        : { ...spec, files: filesRef.current }
      const content = buildCodeDemoMarkdown(editTitle, nextSpec)
      const res = await fetch(`/api/studio/documents/content?source=${encodeURIComponent(selected.source)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title: editTitle, type: 'code-demo' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      setSpec(nextSpec)
      setDemos((prev) => prev.map((d) => d.source === selected.source ? { ...d, title: editTitle } : d))
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
      setSaveState('error')
    }
  }

  if (loading) return <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">Loading…</div>

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — list of code demos */}
      <div className="w-64 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 shrink-0">
          <span className="text-xs text-zinc-500">{demos.length} demo{demos.length !== 1 ? 's' : ''}</span>
          {!isViewer && (
            <button
              onClick={() => setCreating((v) => !v)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${creating ? 'border-indigo-500 text-indigo-400 bg-indigo-950/40' : 'border-zinc-600 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400'}`}
            >{creating ? 'Cancel' : '+ New'}</button>
          )}
        </div>

        {!isViewer && creating && (
          <div className="border-b border-zinc-700 px-4 py-3 space-y-2 shrink-0">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createDemo() }}
              placeholder="Demo title"
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value as 'react' | 'python')}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="react">JavaScript / React</option>
              <option value="python">Python</option>
            </select>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <button onClick={createDemo} className="w-full text-xs py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Create</button>
          </div>
        )}

        <ul className="flex-1 overflow-y-auto divide-y divide-zinc-800">
          {demos.length === 0 && !creating && (
            <li className="px-4 py-8 text-xs text-zinc-600 text-center">No code demos yet</li>
          )}
          {demos.map((demo) => (
            <li
              key={demo.source}
              onClick={() => loadDemo(demo)}
              className={`group flex items-center justify-between gap-2 px-4 py-3 cursor-pointer transition-colors ${selected?.source === demo.source ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'}`}
            >
              <span className="text-xs text-zinc-200 truncate">{demo.title}</span>
              {!isViewer && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteDemo(demo) }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs transition-all shrink-0"
                >✕</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Main — editor */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Select or create a code demo
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700 shrink-0">
            {isViewer ? (
              <span className="text-sm font-medium text-zinc-200 truncate">{editTitle}</span>
            ) : (
              <input
                key={selected.source}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-sm font-medium text-zinc-200 bg-transparent border-b border-transparent hover:border-zinc-600 focus:border-indigo-500 focus:outline-none px-1 min-w-[8rem] max-w-xs"
              />
            )}
            <div className="flex items-center gap-2">
              {saveState === 'error' && <span className="text-xs text-red-400">{saveError}</span>}
              {saveState === 'saved' && <span className="text-xs text-emerald-400">Saved</span>}
              {!isViewer && spec && (
                <button
                  onClick={save}
                  disabled={saveState === 'saving'}
                  className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden overflow-y-auto">
            {docLoading && <div className="flex items-center justify-center h-full text-zinc-500 text-sm">Loading…</div>}
            {docError && <div className="p-4 text-xs text-red-400">{docError}</div>}
            {spec && spec.template === 'python' && (
              <div className="p-4">
                <PythonDemoBlock
                  key={selected.source}
                  code={pythonCode}
                  onChange={isViewer ? undefined : setPythonCode}
                  dependencies={pythonDeps}
                  onDependenciesChange={isViewer ? undefined : setPythonDeps}
                />
              </div>
            )}
            {spec && spec.template !== 'python' && (
              <SandpackProvider
                key={selected.source}
                template={(spec.template as Exclude<CodeDemoSpec['template'], 'python'>) ?? 'react'}
                theme={zincSandpackTheme}
                files={spec.files}
                customSetup={spec.dependencies ? { dependencies: spec.dependencies } : undefined}
                options={{ visibleFiles: Object.keys(spec.files), activeFile: Object.keys(spec.files)[0] }}
                style={{ height: '100%' }}
              >
                <FilesBridge filesRef={filesRef} />
                <SandpackLayout style={{ height: '100%', borderRadius: 0, border: 'none' }}>
                  <SandpackFileExplorer style={{ height: '100%' }} />
                  <SandpackCodeEditor style={{ height: '100%' }} showLineNumbers showTabs readOnly={isViewer} />
                  <SandpackPreview style={{ height: '100%' }} showNavigator />
                </SandpackLayout>
              </SandpackProvider>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
