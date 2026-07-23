'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// Pinned CDN release — bump deliberately, Pyodide's WASM runtime isn't forward/backward compatible across minors.
const PYODIDE_VERSION = '0.26.4'
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

type PyodideInterface = {
  setStdout: (opts: { batched: (msg: string) => void }) => void
  setStderr: (opts: { batched: (msg: string) => void }) => void
  runPythonAsync: (code: string) => Promise<unknown>
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
      return window.loadPyodide!({ indexURL: PYODIDE_INDEX_URL })
    })()
  }
  return pyodidePromise
}

type Props = {
  code: string
  onChange?: (code: string) => void  // presence of onChange makes the editor writable
}

export default function PythonDemoBlock({ code, onChange }: Props) {
  const [output, setOutput] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [loadingRuntime, setLoadingRuntime] = useState(false)
  const [error, setError] = useState('')
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
      if (!alreadyLoaded) setLoadingRuntime(true)
      const pyodide = await getPyodide()
      setLoadingRuntime(false)
      pyodide.setStdout({ batched: (msg) => setOutput((prev) => [...prev, msg]) })
      pyodide.setStderr({ batched: (msg) => setOutput((prev) => [...prev, msg]) })
      await pyodide.runPythonAsync(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
      setLoadingRuntime(false)
    }
  }, [code])

  const editable = !!onChange

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-700/50 bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">Python</span>
        <button
          onClick={run}
          disabled={running}
          className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
        >
          {loadingRuntime ? 'Loading Python…' : running ? 'Running…' : '▶ Run'}
        </button>
      </div>

      <textarea
        value={code}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!editable}
        spellCheck={false}
        rows={Math.min(20, Math.max(6, code.split('\n').length))}
        className={`w-full bg-zinc-950 text-zinc-200 font-mono text-sm px-4 py-3 resize-none focus:outline-none leading-relaxed ${!editable ? 'cursor-text' : ''}`}
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
            <span className="text-zinc-600">{running ? 'Running…' : 'Click Run to execute this script.'}</span>
          )}
        </div>
      </div>
    </div>
  )
}
