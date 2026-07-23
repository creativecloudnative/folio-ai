'use client'

import { Sandpack } from '@codesandbox/sandpack-react'
import type { SandpackPredefinedTemplate } from '@codesandbox/sandpack-react'
import { zincSandpackTheme } from '@/lib/sandpackTheme'

type Props = {
  template: SandpackPredefinedTemplate
  files: Record<string, string>
  dependencies?: Record<string, string>
}

export default function SandpackDemo({ template, files, dependencies }: Props) {
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-700/50">
      <Sandpack
        template={template}
        theme={zincSandpackTheme}
        files={files}
        customSetup={dependencies ? { dependencies } : undefined}
        options={{
          showLineNumbers: true,
          showTabs: Object.keys(files).length > 1,
          editorHeight: 360,
          editorWidthPercentage: 50,
        }}
      />
    </div>
  )
}
