'use client'

import { Suspense, lazy } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const MermaidBlock = lazy(() => import('./MermaidBlock'))

type Props = {
  content: string
  title: string
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-white mt-10 mb-4 leading-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-white mt-10 mb-3 pb-2 border-b border-zinc-700">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-zinc-200 mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-zinc-300 leading-relaxed mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-5 space-y-1 mb-4 text-zinc-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-5 space-y-1 mb-4 text-zinc-300">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
  hr: () => <hr className="border-zinc-700 my-8" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-600 pl-4 italic text-zinc-400 my-4">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-indigo-400 hover:text-indigo-300 underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm border-collapse border border-zinc-700">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-800 text-zinc-300">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-zinc-700 text-zinc-400">{children}</tbody>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left font-medium border-b border-zinc-700">{children}</th>
  ),
  td: ({ children }) => <td className="px-4 py-2">{children}</td>,
  pre: ({ children }) => (
    <pre className="bg-zinc-900 rounded-lg p-4 overflow-x-auto mb-4 border border-zinc-700 text-sm">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1]
    if (lang === 'mermaid') {
      return (
        <Suspense
          fallback={
            <div className="text-xs text-zinc-500 py-4 text-center">Rendering diagram…</div>
          }
        >
          <MermaidBlock code={String(children).trim()} />
        </Suspense>
      )
    }
    return (
      <code className="font-mono text-sm bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-200">
        {children}
      </code>
    )
  },
}

export default function CaseStudyContent({ content }: Props) {
  return (
    <div className="prose-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
