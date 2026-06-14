'use client'

import config from '../../folio.config'
import { useState, useRef, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import Image from 'next/image'

type AttachedFile = { name: string; text: string }

type Message = {
  role: 'user' | 'assistant'
  content: string
  toolStatus?: string | null
}

const CAPABILITIES_PATH = '/folio-ai/assistant'

function MessageContent({ content, onCapabilitiesOpen }: {
  content: string
  onCapabilitiesOpen?: () => void
}) {
  // Matches [text](url) markdown links OR bare https:// URLs — new instance per render avoids lastIndex mutation
  const LINK_REGEX = /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)|(https?:\/\/[^\s)>\]"*]+)/g
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = LINK_REGEX.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index))

    if (match[1] !== undefined) {
      // Markdown link: [text](url)
      const text = match[1]
      const url  = match[2]
      // Intercept capabilities link — open drawer instead of navigating
      if (onCapabilitiesOpen && url === CAPABILITIES_PATH) {
        parts.push(
          <button
            key={match.index}
            onClick={onCapabilitiesOpen}
            className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
          >{text}</button>
        )
      } else {
        const external = url.startsWith('http')
        parts.push(
          <a
            key={match.index}
            href={url}
            target={external ? '_blank' : '_self'}
            rel={external ? 'noopener noreferrer' : undefined}
            className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
          >{text}</a>
        )
      }
    } else {
      // Bare https:// URL
      const url = match[3]
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 break-all"
        >{url}</a>
      )
    }
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(content.slice(last))

  return <span className="whitespace-pre-wrap">{parts}</span>
}

// ── Capabilities drawer content ───────────────────────────────────────────────
const CAPABILITIES = [
  {
    label: 'Answer questions',
    color: 'text-indigo-500',
    icon: '?',
    items: [
      "What's Clint's experience with Kubernetes?",
      'What cloud platforms has he worked on?',
      'Has he led any platform or infrastructure teams?',
      'Does he have experience with AI or ML systems?',
    ],
  },
  {
    label: 'Job fit analysis',
    color: 'text-amber-500',
    icon: '⚡',
    items: [
      "Here's our JD for a Staff SA role — how well does he fit?",
      "We're hiring for AI platform experience. Check the fit? [paste JD]",
    ],
  },
  {
    label: 'Schedule a meeting',
    color: 'text-emerald-500',
    icon: '→',
    items: [
      "I'd like to schedule a call to discuss a potential opportunity.",
      "Can we set up time to talk about a consulting engagement?",
    ],
  },
  {
    label: 'Send a message',
    color: 'text-violet-500',
    icon: '✉',
    items: [
      "Can you pass along that I'm interested in an open role at our company?",
      "I'd love to get Clint's take on our migration — can you send a note?",
    ],
  },
]

function CapabilitiesPanel() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      <p className="text-xs text-slate-400 leading-relaxed">
        {config.agent.assistantName} has full context on Clint&apos;s background and can take real actions on your behalf.
      </p>
      {CAPABILITIES.map((cap) => (
        <div key={cap.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{cap.label}</p>
          <div className="space-y-1.5">
            {cap.items.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2">
                <span className={`${cap.color} shrink-0 text-xs mt-px`}>{cap.icon}</span>
                <span className="text-xs text-slate-300 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

type ChatButtonProps = {
  apiPath?: string
  capabilitiesUrl?: string
}

export default function ChatButton({ apiPath = '/api/chat', capabilitiesUrl }: ChatButtonProps) {
  const greeting = capabilitiesUrl
    ? `${config.agent.greeting}\n\n[See what I can do →](${capabilitiesUrl})`
    : config.agent.greeting

  const [open, setOpen]           = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: greeting },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attached, setAttached] = useState<AttachedFile | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: session } = useSession()

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`
  }, [input])

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setAttachError(null)
    setIsExtracting(true)

    try {
      const name = file.name.toLowerCase()
      let text: string

      if (name.endsWith('.txt') || name.endsWith('.md')) {
        text = await file.text()
      } else {
        const buffer = await file.arrayBuffer()
        const content = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        const fileType = name.endsWith('.docx') ? 'docx' : 'pdf'
        const res = await fetch(`${apiPath}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, fileType }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
        text = data.text
      }

      setAttached({ name: file.name, text })
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Could not read file')
    } finally {
      setIsExtracting(false)
    }
  }

  async function sendMessage() {
    if ((!input.trim() && !attached) || isLoading) return

    const userText = input.trim()
    const content = attached
      ? userText
        ? `${userText}\n\n[Attached: ${attached.name}]\n${attached.text}`
        : `[Attached: ${attached.name}]\n${attached.text}`
      : userText

    // Display a compact version — don't flood the chat with the full file
    const displayContent = attached
      ? userText
        ? `${userText}\n\n📎 ${attached.name}`
        : `📎 ${attached.name}`
      : userText

    setInput('')
    setAttached(null)
    setAttachError(null)

    const newMessages: Message[] = [...messages, { role: 'user', content: displayContent }]
    setMessages(newMessages)
    setIsLoading(true)

    // Push an empty assistant message — we'll stream into it
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      // Send real content (with file text) to API, but display compact version in UI
      const apiMessages = newMessages.map((m, i) =>
        i === newMessages.length - 1 ? { role: m.role, content } : { role: m.role, content: m.content }
      )
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break

          let parsed: Record<string, unknown> | null = null
          try {
            parsed = JSON.parse(data)
          } catch {
            continue
          }
          if (parsed?.error) {
            throw new Error(String(parsed.error))
          }
          if (parsed?.delta) {
            assistantText += parsed.delta as string
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                role: 'assistant',
                content: assistantText,
                toolStatus: null,
              }
              return updated
            })
          }
          if (parsed && 'tool' in parsed) {
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                toolStatus: parsed.tool as string | null,
              }
              return updated
            })
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting right now. Please try again.",
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col overflow-hidden"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/60 shrink-0">
            <div className="flex items-center gap-2">
              {drawerOpen ? (
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors mr-1"
                  aria-label="Back to chat"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className="text-sm font-medium text-white">
                {drawerOpen ? `What can I do?` : config.agent.assistantName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {session?.user && (
                <div className="flex items-center gap-1.5">
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-xs text-slate-400">
                    {session.user.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => { setOpen(false); setDrawerOpen(false) }}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Sliding panel container */}
          <div className="flex-1 relative overflow-hidden">
            <div
              className="absolute inset-0 flex transition-transform duration-300 ease-in-out"
              style={{ width: '200%', transform: drawerOpen ? 'translateX(-50%)' : 'translateX(0)' }}
            >
              {/* ── Left panel: chat ── */}
              <div className="flex flex-col overflow-hidden" style={{ width: '50%' }}>

          {/* Sign-in gate */}
          {!session?.user ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
              <div className="w-10 h-10 rounded-full bg-indigo-900/60 border border-indigo-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 mb-1">{config.agent.greeting}</p>
                <p className="text-xs text-slate-500">Sign in with LinkedIn to start chatting.</p>
              </div>
              <button
                onClick={() => signIn('linkedin', { callbackUrl: window.location.href })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-medium transition-colors"
              >
                <LinkedInIcon className="w-4 h-4" />
                Sign in with LinkedIn
              </button>
              <p className="text-xs text-slate-600 max-w-[220px]">
                We only use your name and email to identify you.{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400 transition-colors">
                  Privacy policy
                </a>
              </p>
            </div>
          ) : (
            <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/50'
                  }`}
                >
                  {msg.toolStatus && (
                    <div className="text-xs text-indigo-400 mb-1.5 italic">{msg.toolStatus}</div>
                  )}
                  {msg.content ? (
                    <MessageContent content={msg.content} onCapabilitiesOpen={() => setDrawerOpen(true)} />
                  ) : (
                    <span className="inline-flex items-center gap-1 py-0.5">
                      <span
                        className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-700">
            {/* Attached file badge */}
            {attached && (
              <div className="px-4 pt-2 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-950/60 border border-indigo-700/50 text-xs text-indigo-300 max-w-full">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="truncate">{attached.name}</span>
                  <button onClick={() => setAttached(null)} className="ml-1 text-indigo-400 hover:text-white shrink-0" aria-label="Remove attachment">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {attachError && (
              <p className="px-4 pt-1.5 text-xs text-red-400">{attachError}</p>
            )}
            <div className="px-4 py-3">
              <div className="flex items-end gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-indigo-600 transition-colors">
                {/* Attachment button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf,.docx"
                  onChange={handleFileAttach}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isExtracting}
                  className="text-slate-500 hover:text-slate-300 disabled:text-slate-700 transition-colors shrink-0 mb-0.5"
                  aria-label="Attach file"
                  title="Attach .txt, .pdf, or .docx"
                >
                  {isExtracting ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attached ? 'Add a message or just send…' : 'Ask me anything…'}
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none disabled:opacity-50 resize-none leading-5"
                />
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !attached) || isLoading}
                  className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 transition-colors shrink-0 mb-0.5"
                  aria-label="Send"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">Shift+Enter for new line · attach .txt .pdf .docx</p>
            </div>
              </div>
            </>
          )}
              </div>{/* end left panel */}

              {/* ── Right panel: capabilities ── */}
              <div className="flex flex-col overflow-hidden border-l border-slate-700/50" style={{ width: '50%' }}>
                <CapabilitiesPanel />
              </div>

            </div>{/* end sliding container */}
          </div>{/* end relative wrapper */}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 transition-all hover:scale-105 active:scale-95"
        aria-label="Open chat"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          />
        </svg>
        <span className="text-sm font-medium">Ask {config.agent.assistantName}</span>
      </button>
    </>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}
