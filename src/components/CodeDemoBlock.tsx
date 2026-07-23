'use client'

import { lazy, Suspense } from 'react'
import type { SandpackPredefinedTemplate } from '@codesandbox/sandpack-react'
import type { CodeDemoSpec } from '@/lib/codeDemo'
import { PYTHON_ENTRY } from '@/lib/codeDemo'

const SandpackDemo = lazy(() => import('./SandpackDemo'))
const PythonDemoBlock = lazy(() => import('./PythonDemoBlock'))

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

  if (parsed.template === 'python') {
    const code = parsed.files[PYTHON_ENTRY] ?? Object.values(parsed.files)[0]
    return (
      <Suspense fallback={<div className="text-xs text-zinc-500 py-4 text-center">Loading Python demo…</div>}>
        <PythonDemoBlock code={code} />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<div className="text-xs text-zinc-500 py-4 text-center">Loading live demo…</div>}>
      <SandpackDemo
        template={(parsed.template as SandpackPredefinedTemplate) ?? 'react'}
        files={parsed.files}
        dependencies={parsed.dependencies}
      />
    </Suspense>
  )
}
