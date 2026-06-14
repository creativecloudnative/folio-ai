'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StudioChat from './StudioChat'
import DocumentsTable from './DocumentsTable'
import ConversationHistory, { type StoredConversation } from './ConversationHistory'
import CompositionsTab from './CompositionsTab'

type Tab = 'chat' | 'documents' | 'history' | 'compositions'

type RestoredConversation = {
  id: string
  title: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
} | null

type TokenBalance = { budget: number; used: number; remaining: number }

type Props = {
  initialBalance?: TokenBalance | null
  folioSlug?: string
}

const TAB_META: Record<Tab, { label: string; short: string; detail: string }> = {
  chat: {
    label: 'Chat',
    short: 'Draft content, manage documents, and control your portfolio with your AI assistant.',
    detail: `Your studio assistant has full context on your portfolio and can take real actions via tool calls. Ask it to write case studies, generate Mermaid diagrams, search existing content, save memories about people you've worked with, or publish compositions. It runs a ReAct loop — it reasons, calls tools, observes results, and reasons again — so complex multi-step tasks work in a single conversation. Everything it saves persists immediately to your portfolio.`,
  },
  history: {
    label: 'History',
    short: 'Browse and restore past conversations.',
    detail: `All chat sessions are saved automatically with a title derived from the first message. Conversations are listed newest-first. Click any entry to restore the full message history in the Chat tab — you can pick up exactly where you left off. Rename any conversation by clicking its title in the chat toolbar.`,
  },
  documents: {
    label: 'Documents',
    short: 'Encoded documents powering semantic search and AI context retrieval.',
    detail: `Every document you save — whether written in Chat or uploaded here — is chunked into overlapping segments, run through an embedding model, and stored as vectors in pgvector. This encoding is what makes semantic search work: the AI can find relevant context even when the query wording differs from the document text. The table shows all encoded chunks grouped by source file. Chunks, type, and creation date are all visible. You can upload new files, toggle published status on portfolio pieces, download raw Markdown, or delete documents to remove them from the context pool entirely.`,
  },
  compositions: {
    label: 'Compositions',
    short: 'Build and publish pages by combining documents and other compositions.',
    detail: `A composition is a named, publishable page assembled from one or more source documents — and optionally from other compositions. When you hit Publish, Claude reads all the source material and generates a polished Markdown page in one pass. Compositions can nest: include another composition as an item and its compiled content is embedded inline. The Folio Page composition is special — its items determine which compositions appear as sections on your public portfolio page, and in what order. Use "Apply to folio" to push layout changes live without recompiling content.`,
  },
}

const VALID_TABS: Tab[] = ['chat', 'history', 'documents', 'compositions']

export default function StudioTabs({ initialBalance, folioSlug }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const tabParam     = searchParams.get('tab') as Tab | null
  const initialTab   = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'chat'

  const [active, setActive] = useState<Tab>(initialTab)
  const [expanded, setExpanded] = useState(false)
  const [restoredConversation, setRestoredConversation] = useState<RestoredConversation>(null)

  // Collapse detail when switching tabs; persist tab to URL
  function switchTab(tab: Tab) {
    if (tab !== active) setExpanded(false)
    setActive(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // Auto-load the most recently updated conversation on mount
  useEffect(() => {
    let cancelled = false
    async function loadLatest() {
      try {
        const listRes = await fetch('/api/studio/conversations')
        if (!listRes.ok || cancelled) return
        const { conversations } = await listRes.json()
        if (!conversations?.length || cancelled) return

        const convRes = await fetch(`/api/studio/conversations/${conversations[0].id}`)
        if (!convRes.ok || cancelled) return
        const { conversation } = await convRes.json()
        if (!cancelled) {
          setRestoredConversation({
            id: conversation.id,
            title: conversation.title,
            messages: conversation.messages ?? [],
          })
        }
      } catch {
        // silently ignore — just show the greeting instead
      }
    }
    loadLatest()
    return () => { cancelled = true }
  }, [])

  function handleRename(id: string, title: string) {
    setRestoredConversation((prev) => prev?.id === id ? { ...prev, title } : prev)
  }

  function handleRestore(conv: StoredConversation) {
    setRestoredConversation({
      id: conv.id,
      title: conv.title,
      messages: (conv.messages ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>,
    })
    setActive('chat')
  }

  const meta = TAB_META[active]

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/60 px-4 shrink-0">
        {(['chat', 'history', 'documents', 'compositions'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === tab
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {TAB_META[tab].label}
          </button>
        ))}
      </div>

      {/* Description strip */}
      <div className="shrink-0 border-b border-zinc-800/70 bg-zinc-900/30 px-4 py-2">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-xs text-zinc-500 leading-relaxed">{meta.short}</p>
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Hide details' : 'Show details'}
            className={`shrink-0 mt-px text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
              expanded
                ? 'border-indigo-600/60 text-indigo-400 bg-indigo-950/30'
                : 'border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400'
            }`}
          >
            {expanded ? '▲ less' : 'ⓘ more'}
          </button>
        </div>
        {expanded && (
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-2">
            {meta.detail}
          </p>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {active === 'chat' && (
          <StudioChat
            restoredConversation={restoredConversation}
            onNewConversation={() => setRestoredConversation(null)}
            onRename={handleRename}
            initialBalance={initialBalance}
          />
        )}
        {active === 'history' && (
          <ConversationHistory onRestore={handleRestore} />
        )}
        {active === 'documents' && <DocumentsTable folioSlug={folioSlug} />}
        {active === 'compositions' && <CompositionsTab folioSlug={folioSlug} />}
      </div>
    </div>
  )
}
