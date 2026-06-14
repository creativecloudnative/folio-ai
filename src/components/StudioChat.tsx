'use client'

import { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react'

const MermaidBlock = lazy(() => import('./MermaidBlock'))

type Segment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = []
  const re = /```(\w*)\n([\s\S]*?)```/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) segments.push({ type: 'text', content: text.slice(last, match.index) })
    segments.push({ type: 'code', lang: match[1].toLowerCase(), content: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) })
  return segments
}

function MessageBody({ content }: { content: string }) {
  const segments = parseSegments(content)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'code' && seg.lang === 'mermaid') {
          return (
            <Suspense key={i} fallback={<div className="text-xs text-zinc-500 py-2">Rendering diagram…</div>}>
              <MermaidBlock code={seg.content} />
            </Suspense>
          )
        }
        if (seg.type === 'code') {
          return (
            <pre key={i} className="my-2 p-3 rounded-lg bg-zinc-900 border border-zinc-700/50 text-xs overflow-x-auto whitespace-pre">
              <code>{seg.content}</code>
            </pre>
          )
        }
        return <span key={i} className="whitespace-pre-wrap">{seg.content}</span>
      })}
    </>
  )
}

type Role = 'user' | 'assistant'

type Message = {
  id: string
  role: Role
  content: string
  toolStatus?: string
}

const GREETING = `Welcome to your design studio. I can help you build out your folio.

Here's what we can work on:
- **Case study** — walk me through a project and I'll structure it into a published portfolio piece
- **Architecture design** — describe a system you've built or designed and I'll document it with diagrams
- **Bio** — tell me about yourself and I'll draft a bio for your folio
- **Journal entry** — share a technical opinion, lesson learned, or career reflection
- **Connection** — add a profile for someone who may visit your folio so I can personalize their experience
- **Memory** — capture a career moment involving a specific person

Once we create something, you can publish it directly from the Documents tab.

What would you like to work on?`

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

type TokenBalance = { budget: number; used: number; remaining: number }

type Props = {
  restoredConversation?: { id: string; title: string; messages: Array<{ role: Role; content: string }> } | null
  onNewConversation?: () => void
  onRename?: (id: string, title: string) => void
  initialBalance?: TokenBalance | null
}

// ── Studio capabilities panel ─────────────────────────────────────────────────
const STUDIO_CAPABILITIES = [
  {
    label: 'Draft content',
    color: 'text-indigo-400',
    icon: '✍',
    items: [
      'Walk me through the Kubernetes platform migration I led — make it a case study.',
      "I want to document the multi-tenant architecture I designed. Let's write it up.",
      'Help me write a bio for my folio.',
      "I have a take on platform engineering vs DevOps — let's write a journal entry.",
      'Draft an ADR for the decision to use pgvector over Pinecone.',
    ],
  },
  {
    label: 'Create diagrams',
    color: 'text-violet-400',
    icon: '◈',
    items: [
      'Draw a sequence diagram for the ReAct agent loop in this site.',
      'Create a Mermaid flowchart for my CI/CD pipeline.',
      'Diagram the multi-cluster Kubernetes architecture we use.',
    ],
  },
  {
    label: 'Connections & memories',
    color: 'text-emerald-400',
    icon: '◉',
    items: [
      'Add a connection profile for Sarah at Acme — she may visit the site.',
      'Save a memory about the platform rebuild with Jordan in 2022.',
      "Look up what I've saved about Marcus.",
    ],
  },
  {
    label: 'Search & manage',
    color: 'text-amber-400',
    icon: '⌕',
    items: [
      'What case studies do I have saved?',
      'Search for anything I\'ve written about cost optimization.',
      'Show me the resume I uploaded last week.',
      'List all my compositions and what\'s published.',
    ],
  },
]

function StudioCapabilitiesPanel() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-3xl mx-auto w-full">
      <div>
        <p className="text-sm text-zinc-300 font-medium mb-1">Your studio assistant</p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          A full ReAct agent with tools to write, save, search, and publish your portfolio content.
          Everything it creates goes straight into your vector database.
        </p>
      </div>
      {STUDIO_CAPABILITIES.map((cap) => (
        <div key={cap.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">{cap.label}</p>
          <div className="space-y-1.5">
            {cap.items.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                <span className={`${cap.color} shrink-0 text-xs mt-px`}>{cap.icon}</span>
                <span className="text-xs text-zinc-400 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function StudioChat({ restoredConversation, onNewConversation, onRename, initialBalance }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'greeting', role: 'assistant', content: GREETING },
  ])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationTitle, setConversationTitle] = useState<string>('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(initialBalance ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Restore a saved conversation when the prop changes
  useEffect(() => {
    if (!restoredConversation) return
    const restored: Message[] = restoredConversation.messages.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role,
      content: m.content,
    }))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(restored.length > 0 ? restored : [{ id: 'greeting', role: 'assistant', content: GREETING }])
    setConversationId(restoredConversation.id)
    setConversationTitle(restoredConversation.title)
    setEditingTitle(false)
  }, [restoredConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [input])

  const saveConversation = useCallback(async (msgs: Message[], existingId: string | null) => {
    const saveable = msgs.filter((m) => m.id !== 'greeting' && m.content.trim())
    if (saveable.length === 0) return existingId

    const firstUser = saveable.find((m) => m.role === 'user')
    const title = firstUser
      ? firstUser.content.slice(0, 80).replace(/\n/g, ' ').trim()
      : 'Untitled'

    const payload = {
      id: existingId ?? undefined,
      title,
      messages: saveable.map((m) => ({ role: m.role, content: m.content })),
    }

    try {
      const res = await fetch('/api/studio/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) return existingId
      const data = await res.json()
      return data.id as string
    } catch {
      return existingId
    }
  }, [])

  function startNewConversation() {
    setMessages([{ id: 'greeting', role: 'assistant', content: GREETING }])
    setConversationId(null)
    setConversationTitle('')
    setEditingTitle(false)
    setInput('')
    onNewConversation?.()
  }

  async function renameConversation(newTitle: string) {
    const trimmed = newTitle.trim()
    setEditingTitle(false)
    if (!trimmed || trimmed === conversationTitle || !conversationId) return
    setConversationTitle(trimmed)
    onRename?.(conversationId, trimmed)
    await fetch(`/api/studio/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const newMessages = [...messages.filter((m) => m.id !== 'greeting'), userMsg]
    setMessages((prev) => [...prev.filter((m) => m.id !== 'greeting'), userMsg])
    setInput('')
    setIsLoading(true)

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', toolStatus: undefined },
    ])

    let finalMessages: Message[] = []

    try {
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 402 && err.budget) setTokenBalance(err.budget as TokenBalance)
        throw new Error(
          res.status === 402
            ? 'Token budget exhausted. No tokens remaining for this folio.'
            : (err.error ?? `HTTP ${res.status}`),
        )
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break

          try {
            const parsed = JSON.parse(payload)

            if (parsed.delta) {
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.delta, toolStatus: undefined }
                    : m,
                )
                finalMessages = updated
                return updated
              })
            }

            if (parsed.tool) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolStatus: parsed.tool } : m,
                ),
              )
            }

            if (parsed.budget) {
              setTokenBalance(parsed.budget as TokenBalance)
            }

            if (parsed.error) throw new Error(parsed.error)
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${msg}`, toolStatus: undefined }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      // Auto-save after each complete exchange
      if (finalMessages.length > 0) {
        const savedId = await saveConversation(finalMessages, conversationId)
        if (savedId && savedId !== conversationId) {
          setConversationId(savedId)
          // Derive the auto-title from the first user message (same logic as saveConversation)
          if (!conversationId) {
            const firstUser = finalMessages.find((m) => m.role === 'user')
            if (firstUser) {
              setConversationTitle(firstUser.content.slice(0, 80).replace(/\n/g, ' ').trim())
            }
          }
        }
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('uploading')
    setUploadMessage('')

    try {
      const name = file.name.toLowerCase()
      const isBinary = name.endsWith('.pdf') || name.endsWith('.docx')
      let content: string
      let fileType: 'text' | 'pdf' | 'docx'
      if (isBinary) {
        const buffer = await file.arrayBuffer()
        content = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        fileType = name.endsWith('.docx') ? 'docx' : 'pdf'
      } else {
        content = await file.text()
        fileType = 'text'
      }

      const res = await fetch('/api/studio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content, fileType, type: 'resume', isBaseline: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setUploadStatus('success')
      setUploadMessage(`"${file.name}" ingested as baseline resume (${data.chunks} chunks)`)
    } catch (err) {
      setUploadStatus('error')
      setUploadMessage(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Conversation toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => renameConversation(titleDraft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameConversation(titleDraft)
              if (e.key === 'Escape') setEditingTitle(false)
            }}
            className="flex-1 mr-4 bg-zinc-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-zinc-100 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => {
              if (!conversationId) return
              setTitleDraft(conversationTitle)
              setEditingTitle(true)
            }}
            title={conversationId ? 'Click to rename' : undefined}
            className={`text-xs truncate max-w-xs text-left transition-colors ${
              conversationId
                ? 'text-zinc-300 hover:text-indigo-400 cursor-text'
                : 'text-zinc-500 cursor-default'
            }`}
          >
            {conversationTitle || (conversationId ? 'Untitled' : 'New conversation')}
          </button>
        )}
        <div className="flex items-center gap-3">
          {tokenBalance && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    tokenBalance.remaining / tokenBalance.budget > 0.2
                      ? 'bg-indigo-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.max(0, (tokenBalance.remaining / tokenBalance.budget) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">
                {(tokenBalance.remaining / 1000).toFixed(0)}k left
              </span>
            </div>
          )}
          <button
            onClick={() => setDrawerOpen((d) => !d)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              drawerOpen
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/30'
                : 'border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400'
            }`}
          >
            {drawerOpen ? '← Chat' : 'What can I do?'}
          </button>
          <button
            onClick={startNewConversation}
            className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {/* Messages / capabilities sliding panel */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-in-out"
          style={{ width: '200%', transform: drawerOpen ? 'translateX(-50%)' : 'translateX(0)' }}
        >
          {/* Left panel — messages */}
          <div className="overflow-y-auto px-4 py-6 space-y-6" style={{ width: '50%' }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-lg px-4 py-3 text-sm leading-relaxed font-mono ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  }`}
                >
                  {msg.toolStatus && (
                    <div className="text-xs text-indigo-400 mb-2 italic">{msg.toolStatus}</div>
                  )}
                  {msg.content
                    ? <MessageBody content={msg.content} />
                    : <span className="text-zinc-500 italic">{msg.toolStatus ? '' : 'Thinking…'}</span>
                  }
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Right panel — capabilities */}
          <div className="overflow-y-auto border-l border-zinc-800" style={{ width: '50%' }}>
            <StudioCapabilitiesPanel />
          </div>
        </div>
      </div>

      {/* Baseline resume upload */}
      <div className="border-t border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <span className="text-xs text-zinc-500 shrink-0">Baseline resume:</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf,.docx"
            onChange={handleFileUpload}
            disabled={uploadStatus === 'uploading'}
            className="hidden"
            id="resume-upload"
          />
          <label
            htmlFor="resume-upload"
            className={`cursor-pointer text-xs px-3 py-1.5 rounded border transition-colors ${
              uploadStatus === 'uploading'
                ? 'border-zinc-700 text-zinc-600 cursor-not-allowed'
                : 'border-zinc-600 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400'
            }`}
          >
            {uploadStatus === 'uploading' ? 'Uploading…' : 'Upload .md, .txt, .pdf or .docx'}
          </label>
          {uploadMessage && (
            <span className={`text-xs truncate ${uploadStatus === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
              {uploadMessage}
            </span>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-700 bg-zinc-900 px-4 py-4">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a project, share a thought, or ask to list existing content…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            {isLoading ? 'Sending…' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center max-w-4xl mx-auto">
          Shift+Enter for new line · Enter to send · Content saves to the vector DB
        </p>
      </div>
    </div>
  )
}
