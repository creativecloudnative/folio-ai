'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { EditorView } from '@codemirror/view'
import { zincCodeMirrorTheme } from '@/lib/codeMirrorTheme'
import { dependenciesToText, textToDependencies } from '@/lib/codeDemo'

const pythonExtensions = [python(), EditorView.lineWrapping]

// Pinned CDN release — bump deliberately, Pyodide's WASM runtime isn't forward/backward compatible across minors.
const PYODIDE_VERSION = '0.26.4'
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

type MicropipModule = {
  install: (specs: string[]) => Promise<void>
}

type PyodideInterface = {
  setStdout: (opts: { batched: (msg: string) => void }) => void
  setStderr: (opts: { batched: (msg: string) => void }) => void
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[]) => Promise<void>
  pyimport: (name: string) => MicropipModule
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>
  }
}

let pyodidePromise: Promise<PyodideInterface> | null = null

function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = `${PYODIDE_INDEX_URL}pyodide.js`
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Pyodide from CDN'))
          document.head.appendChild(script)
        })
      }
      const pyodide = await window.loadPyodide!({ indexURL: PYODIDE_INDEX_URL })
      await pyodide.loadPackage('micropip')
      return pyodide
    })()
  }
  return pyodidePromise
}

function depsToSpecs(deps?: Record<string, string>): string[] {
  return Object.entries(deps ?? {}).map(([name, version]) => (version ? `${name}==${version}` : name))
}

type Props = {
  code: string
  onChange?: (code: string) => void  // presence of onChange makes the code editable
  dependencies?: Record<string, string>
  onDependenciesChange?: (deps: Record<string, string> | undefined) => void  // presence makes deps editable
}

export default function PythonDemoBlock({ code, onChange, dependencies, onDependenciesChange }: Props) {
  const [output, setOutput] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<'idle' | 'runtime' | 'packages' | 'running'>('idle')
  const [error, setError] = useState('')
  const [depsText, setDepsText] = useState(() => dependenciesToText(dependencies))
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  const run = useCallback(async () => {
    setRunning(true)
    setError('')
    setOutput([])
    try {
      const alreadyLoaded = !!pyodidePromise
      setStage(alreadyLoaded ? 'packages' : 'runtime')
      const pyodide = await getPyodide()
      pyodide.setStdout({ batched: (msg) => setOutput((prev) => [...prev, msg]) })
      pyodide.setStderr({ batched: (msg) => setOutput((prev) => [...prev, msg]) })

      const specs = depsToSpecs(dependencies)
      if (specs.length > 0) {
        setStage('packages')
        const micropip = pyodide.pyimport('micropip')
        await micropip.install(specs)
      }

      setStage('running')
      await pyodide.runPythonAsync(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
      setStage('idle')
    }
  }, [code, dependencies])

  const editable = !!onChange
  const depsEditable = !!onDependenciesChange

  function commitDeps() {
    onDependenciesChange?.(textToDependencies(depsText))
  }

  const runLabel = stage === 'runtime' ? 'Loading Python…' : stage === 'packages' ? 'Installing packages…' : stage === 'running' ? 'Running…' : '▶ Run'

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-700/50 bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">Python</span>
        <button
          onClick={run}
          disabled={running}
          className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
        >
          {runLabel}
        </button>
      </div>

      {depsEditable ? (
        <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
          <label className="block text-[10px] font-mono text-zinc-600 uppercase tracking-wide mb-1">
            Dependencies (pip, comma-separated — e.g. requests, numpy==1.26.4)
          </label>
          <input
            value={depsText}
            onChange={(e) => setDepsText(e.target.value)}
            onBlur={commitDeps}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            placeholder="none"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      ) : dependencies && Object.keys(dependencies).length > 0 ? (
        <div className="px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
          <span className="text-[10px] font-mono text-zinc-600">deps: {depsToSpecs(dependencies).join(', ')}</span>
        </div>
      ) : null}

      <CodeMirror
        value={code}
        onChange={(value) => onChange?.(value)}
        editable={editable}
        readOnly={!editable}
        theme={zincCodeMirrorTheme}
        extensions={pythonExtensions}
        basicSetup={{ foldGutter: false, highlightActiveLine: editable, highlightActiveLineGutter: editable }}
        minHeight="120px"
        maxHeight="480px"
        style={{ fontSize: '13px' }}
      />

      <div className="border-t border-zinc-800">
        <div className="px-4 py-1.5 border-b border-zinc-800/60 bg-zinc-900/40">
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wide">Output</span>
        </div>
        <div ref={outputRef} className="max-h-56 overflow-y-auto px-4 py-3 font-mono text-xs whitespace-pre-wrap">
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : output.length > 0 ? (
            <span className="text-zinc-300">{output.join('\n')}</span>
          ) : (
            <span className="text-zinc-600">{running ? runLabel : 'Click Run to execute this script.'}</span>
          )}
        </div>
      </div>
    </div>
  )
}
