'use client'

import { Sandpack } from '@codesandbox/sandpack-react'
import type { SandpackTheme, SandpackPredefinedTemplate } from '@codesandbox/sandpack-react'

const zincTheme: SandpackTheme = {
  colors: {
    surface1: '#18181b',
    surface2: '#27272a',
    surface3: '#3f3f46',
    disabled: '#52525b',
    base: '#e4e4e7',
    clickable: '#a1a1aa',
    hover: '#e4e4e7',
    accent: '#818cf8',
    error: '#f87171',
    errorSurface: '#450a0a',
    warning: '#fbbf24',
    warningSurface: '#451a03',
  },
  syntax: {
    plain: '#e4e4e7',
    comment: { color: '#71717a', fontStyle: 'italic' },
    keyword: '#818cf8',
    tag: '#818cf8',
    punctuation: '#a1a1aa',
    definition: '#a5b4fc',
    property: '#c4b5fd',
    static: '#fbbf24',
    string: '#86efac',
  },
  font: {
    body: 'ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, monospace',
    size: '13px',
    lineHeight: '1.5',
  },
}

type DemoSpec = {
  template?: SandpackPredefinedTemplate
  files: Record<string, string>
  dependencies?: Record<string, string>
}

type Props = {
  spec: string
}

export default function CodeDemoBlock({ spec }: Props) {
  let parsed: DemoSpec
  try {
    parsed = JSON.parse(spec)
  } catch {
    return (
      <div className="my-2 rounded-lg border border-red-800/50 bg-red-950/20 p-3">
        <p className="text-xs text-red-400 mb-2">Invalid code-demo JSON — fix and regenerate:</p>
        <pre className="text-xs text-zinc-500 overflow-x-auto whitespace-pre-wrap">{spec}</pre>
      </div>
    )
  }

  if (!parsed.files || Object.keys(parsed.files).length === 0) {
    return (
      <div className="my-2 rounded-lg border border-red-800/50 bg-red-950/20 p-3">
        <p className="text-xs text-red-400">Code demo has no files</p>
      </div>
    )
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-700/50">
      <Sandpack
        template={parsed.template ?? 'react'}
        theme={zincTheme}
        files={parsed.files}
        customSetup={parsed.dependencies ? { dependencies: parsed.dependencies } : undefined}
        options={{
          showLineNumbers: true,
          showTabs: Object.keys(parsed.files).length > 1,
          editorHeight: 360,
          editorWidthPercentage: 50,
        }}
      />
    </div>
  )
}
