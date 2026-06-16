'use client'

import { useEffect, useRef, useState, useId, useCallback } from 'react'

type Props = {
  code: string
  title?: string
}

export default function MermaidBlock({ code, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    let cancelled = false

    import('mermaid').then((mod) => {
      if (cancelled) return
      const mermaid = mod.default

      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          darkMode: true,
          background: '#18181b',
          primaryColor: '#4f46e5',
          primaryTextColor: '#e4e4e7',
          primaryBorderColor: '#3f3f46',
          lineColor: '#71717a',
          secondaryColor: '#27272a',
          tertiaryColor: '#27272a',
          edgeLabelBackground: '#18181b',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
        },
        securityLevel: 'loose',
      })

      mermaid.render(`m-${uid}`, code.trim())
        .then(({ svg: renderedSvg }) => {
          if (cancelled) return
          setSvg(renderedSvg)
          if (containerRef.current) {
            containerRef.current.innerHTML = renderedSvg
            const svgEl = containerRef.current.querySelector('svg')
            if (svgEl) {
              svgEl.style.maxWidth = '100%'
              svgEl.style.height = 'auto'
            }
          }
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message ?? 'Invalid diagram syntax')
        })
    })

    return () => { cancelled = true }
  }, [code, uid])

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(4, Math.max(0.25, +(z + delta).toFixed(2))))
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === '=' || e.key === '+') handleZoom(0.25)
      if (e.key === '-') handleZoom(-0.25)
      if (e.key === '0') setZoom(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleZoom])

  function downloadSVG() {
    const svgEl = containerRef.current?.querySelector('svg')
    if (!svgEl) return
    const serialized = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([serialized], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = title
      ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.svg'
      : 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="my-2 rounded-lg border border-red-800/50 bg-red-950/20 p-3">
        <p className="text-xs text-red-400 mb-2">Diagram syntax error — fix and regenerate:</p>
        <pre className="text-xs text-zinc-500 overflow-x-auto whitespace-pre-wrap">{code}</pre>
      </div>
    )
  }

  return (
    <>
      <div className="relative group my-3">
        {/* Inline diagram — click to expand */}
        <div
          ref={containerRef}
          onClick={() => svg && setOpen(true)}
          className={`flex justify-start overflow-x-auto rounded-lg bg-zinc-900/60 p-3 border border-zinc-700/50 ${svg ? 'cursor-zoom-in' : ''}`}
        />
        {/* Hover toolbar */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {svg && (
            <button
              onClick={() => setOpen(true)}
              className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400"
              title="Open expanded view"
            >
              ⤢ Expand
            </button>
          )}
          <button
            onClick={downloadSVG}
            className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400"
            title="Download as SVG"
          >
            ↓ SVG
          </button>
        </div>
      </div>

      {/* Modal popout */}
      {open && svg && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
            <span className="text-sm font-medium text-zinc-300">{title ?? 'Diagram'}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleZoom(-0.25)}
                className="text-sm w-8 h-8 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                title="Zoom out (−)"
              >−</button>
              <button
                onClick={() => setZoom(1)}
                className="text-xs px-2 h-8 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors tabular-nums min-w-[52px] text-center"
                title="Reset zoom (0)"
              >{Math.round(zoom * 100)}%</button>
              <button
                onClick={() => handleZoom(0.25)}
                className="text-sm w-8 h-8 flex items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                title="Zoom in (+)"
              >+</button>
              <div className="w-px h-5 bg-zinc-700 mx-1" />
              <button
                onClick={downloadSVG}
                className="text-xs px-3 h-8 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                title="Download SVG"
              >↓ SVG</button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-3 h-8 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                title="Close (Esc)"
              >✕ Close</button>
            </div>
          </div>

          {/* Zoomable canvas */}
          <div
            ref={modalRef}
            className="flex-1 overflow-auto flex items-start justify-center p-8"
          >
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>

          <p className="text-center text-xs text-zinc-600 pb-3 shrink-0">
            + / − to zoom · 0 to reset · Esc to close · click outside to dismiss
          </p>
        </div>
      )}
    </>
  )
}
