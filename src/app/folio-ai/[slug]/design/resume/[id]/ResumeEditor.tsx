'use client'

import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useRouter } from 'next/navigation'
import { RESUME_TEMPLATES, type Resume, type ResumeTemplate } from '@/lib/resumes'

const TEMPLATE_CSS: Record<ResumeTemplate, string> = {
  modern: `
    .resume-body { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 1.6; color: #111; }
    .resume-body h1 { font-size: 2em; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 0.15em; }
    .resume-body h2 { font-size: 0.8em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;
                      color: #4338ca; border-bottom: 1px solid #e0e7ff; padding-bottom: 4px; margin: 1.2em 0 0.5em; }
    .resume-body h3 { font-size: 1em; font-weight: 600; margin: 0.8em 0 0.1em; }
    .resume-body p  { margin: 0.3em 0; }
    .resume-body ul { padding-left: 1.2em; margin: 0.3em 0; }
    .resume-body li { margin: 0.15em 0; }
    .resume-body a  { color: #4338ca; text-decoration: none; }
  `,
  classic: `
    .resume-body { font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.65; color: #111; }
    .resume-body h1 { font-size: 1.8em; font-weight: 700; text-align: center; margin: 0 0 0.1em; letter-spacing: 0.02em; }
    .resume-body h2 { font-size: 0.85em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
                      border-bottom: 2px solid #111; padding-bottom: 2px; margin: 1.1em 0 0.5em; }
    .resume-body h3 { font-size: 1em; font-weight: 700; margin: 0.7em 0 0.1em; }
    .resume-body p  { margin: 0.3em 0; }
    .resume-body ul { padding-left: 1.4em; margin: 0.3em 0; }
    .resume-body li { margin: 0.15em 0; }
    .resume-body a  { color: inherit; }
  `,
  compact: `
    .resume-body { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12.5px; line-height: 1.4; color: #111; }
    .resume-body h1 { font-size: 1.5em; font-weight: 700; margin: 0 0 0.1em; }
    .resume-body h2 { font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
                      border-bottom: 1px solid #aaa; padding-bottom: 1px; margin: 0.9em 0 0.35em; }
    .resume-body h3 { font-size: 0.9em; font-weight: 600; margin: 0.5em 0 0; }
    .resume-body p  { margin: 0.2em 0; }
    .resume-body ul { padding-left: 1.1em; margin: 0.2em 0; }
    .resume-body li { margin: 0.05em 0; }
    .resume-body a  { color: inherit; }
  `,
  minimal: `
    .resume-body { font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.55; color: #000; }
    .resume-body h1 { font-size: 1.4em; font-weight: 700; margin: 0 0 0.1em; }
    .resume-body h2 { font-size: 0.85em; font-weight: 700; text-transform: uppercase;
                      border-bottom: 1px solid #000; padding-bottom: 1px; margin: 1em 0 0.4em; }
    .resume-body h3 { font-size: 0.9em; font-weight: 700; margin: 0.6em 0 0; }
    .resume-body p  { margin: 0.25em 0; }
    .resume-body ul { list-style-type: disc; padding-left: 1.2em; margin: 0.25em 0; }
    .resume-body li { margin: 0.1em 0; }
    .resume-body a  { color: inherit; text-decoration: underline; }
  `,
}

type Props = {
  resume: Resume
  folioSlug: string
  demoSlug?: string
}

export default function ResumeEditor({ resume: initial, folioSlug, demoSlug }: Props) {
  const isViewer = !!demoSlug
  const apiBase = demoSlug ? `/api/folio-ai/${demoSlug}/studio` : '/api/studio'
  const router = useRouter()
  const [content, setContent]     = useState(initial.content)
  const [title, setTitle]         = useState(initial.title)
  const [template, setTemplate]   = useState<ResumeTemplate>(initial.template)
  const [view, setView]           = useState<'split' | 'preview' | 'source'>('split')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [showJob, setShowJob]     = useState(false)
  const [dirty, setDirty]         = useState(false)

  const handleChange = useCallback((val: string) => {
    setContent(val)
    setDirty(true)
    setSaved(false)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/resumes/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title, template }),
      })
      if (res.ok) { setSaved(true); setDirty(false) }
    } finally {
      setSaving(false)
    }
  }

  async function handleTemplateChange(t: ResumeTemplate) {
    setTemplate(t)
    setDirty(true)
    setSaved(false)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* Per-template print + preview styles */}
      <style>{`
        ${TEMPLATE_CSS[template]}
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { background: white; }
          .resume-body { padding: 0; }
        }
        @media screen {
          .print-area-screen { display: block; }
        }
      `}</style>

      <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 no-print">
        {/* Toolbar */}
        <header className="no-print shrink-0 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push(`/folio-ai/${folioSlug}/design?tab=resumes`)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            ← Resumes
          </button>
          <span className="text-zinc-700 text-xs">|</span>

          {/* Title */}
          <input
            value={title}
            onChange={(e) => { if (!isViewer) { setTitle(e.target.value); setDirty(true); setSaved(false) } }}
            readOnly={isViewer}
            className="flex-1 min-w-0 text-sm font-medium bg-transparent text-zinc-200 focus:outline-none focus:text-white placeholder:text-zinc-600"
            placeholder="Resume title"
          />

          <div className="flex items-center gap-2 ml-auto">
            {/* Template switcher */}
            <select
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value as ResumeTemplate)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              {Object.entries(RESUME_TEMPLATES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* View toggle */}
            <div className="flex rounded border border-zinc-700 overflow-hidden">
              {(['split', 'preview', 'source'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-[10px] px-2 py-1 transition-colors ${
                    view === v ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {v === 'split' ? 'Split' : v === 'preview' ? 'Preview' : 'Source'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowJob((v) => !v)}
              className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showJob ? 'Hide JD' : 'Show JD'}
            </button>

            {!isViewer && (
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
              </button>
            )}

            <button
              onClick={handlePrint}
              className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              Print / PDF
            </button>
          </div>
        </header>

        {/* Job description panel */}
        {showJob && (
          <div className="no-print shrink-0 max-h-48 overflow-y-auto border-b border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <p className="text-[10px] font-mono text-zinc-500 mb-1 uppercase tracking-widest">Job Description</p>
            <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{initial.job_description}</p>
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 overflow-hidden flex">

          {/* Source editor */}
          {(view === 'split' || view === 'source') && (
            <div className={`${view === 'split' ? 'w-1/2 border-r border-zinc-800' : 'w-full'} flex flex-col`}>
              <div className="shrink-0 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/40">
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Markdown</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => { if (!isViewer) handleChange(e.target.value) }}
                readOnly={isViewer}
                className="flex-1 font-mono text-xs text-zinc-300 bg-transparent px-4 py-3 resize-none focus:outline-none leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}

          {/* Preview */}
          {(view === 'split' || view === 'preview') && (
            <div className={`${view === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto bg-white`}>
              <div className="resume-body max-w-[800px] mx-auto px-10 py-10 print-area">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print-only full-page render */}
      <div className="hidden print:block resume-body p-12">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </>
  )
}
