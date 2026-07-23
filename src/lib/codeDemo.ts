import type { SandpackPredefinedTemplate } from '@codesandbox/sandpack-react'

// 'python' runs client-side via Pyodide (WASM CPython) — not a Sandpack template,
// handled by a separate renderer. files['/main.py'] is the script; multi-file is
// not supported for python (single-snippet only).
export type CodeDemoSpec = {
  template?: SandpackPredefinedTemplate | 'python'
  files: Record<string, string>
  dependencies?: Record<string, string>
}

export const PYTHON_ENTRY = '/main.py'

const FENCE_RE = /```code-demo\n([\s\S]*?)\n```/

export function extractCodeDemoSpec(markdown: string): CodeDemoSpec | null {
  const match = markdown.match(FENCE_RE)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    if (!parsed.files || typeof parsed.files !== 'object') return null
    return parsed as CodeDemoSpec
  } catch {
    return null
  }
}

export function buildCodeDemoMarkdown(title: string, spec: CodeDemoSpec): string {
  return `# ${title}\n\n\`\`\`code-demo\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n`
}

export const DEFAULT_CODE_DEMO_SPEC: CodeDemoSpec = {
  template: 'react',
  files: {
    '/App.js': 'export default function App() {\n  return <h1>Hello, world!</h1>\n}\n',
  },
}

export const DEFAULT_PYTHON_SPEC: CodeDemoSpec = {
  template: 'python',
  files: {
    [PYTHON_ENTRY]: 'print("Hello, world!")\n',
  },
}

// Python deps reuse the same {name: version} shape as Sandpack's npm deps —
// version '' means "latest". UI round-trips this as a comma-separated
// "name==version" list, matching pip's requirement-specifier syntax.
export function dependenciesToText(deps?: Record<string, string>): string {
  if (!deps) return ''
  return Object.entries(deps)
    .map(([name, version]) => (version ? `${name}==${version}` : name))
    .join(', ')
}

export function textToDependencies(text: string): Record<string, string> | undefined {
  const specs = text.split(',').map((s) => s.trim()).filter(Boolean)
  if (specs.length === 0) return undefined
  const deps: Record<string, string> = {}
  for (const spec of specs) {
    const [name, version] = spec.split('==').map((s) => s.trim())
    if (name) deps[name] = version ?? ''
  }
  return deps
}
