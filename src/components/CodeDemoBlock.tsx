'use client'

import { Sandpack } from '@codesandbox/sandpack-react'
import { zincSandpackTheme } from '@/lib/sandpackTheme'
import type { CodeDemoSpec } from '@/lib/codeDemo'

type Props = {
  spec: string
}

export default function CodeDemoBlock({ spec }: Props) {
  let parsed: CodeDemoSpec
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
        theme={zincSandpackTheme}
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
