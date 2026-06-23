'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StudioChat from './StudioChat'
import DocumentsTable from './DocumentsTable'
import ConversationHistory, { type StoredConversation } from './ConversationHistory'
import CompositionsTab from './CompositionsTab'
import SharingTab from './SharingTab'
import IntegrationsTab from './IntegrationsTab'
import VideosTab from './VideosTab'
import ProfileTab from './ProfileTab'
import ResumeTab from './ResumeTab'
import ApplicationsTab from './ApplicationsTab'
import DashboardTab from './DashboardTab'
import EvidenceTab from './EvidenceTab'
import type { FolioVideo } from '@/lib/videos'

type Tab =
  | 'dashboard'
  | 'chat' | 'history'
  | 'documents' | 'compositions' | 'videos'
  | 'resumes' | 'applications' | 'evidence'
  | 'sharing' | 'integrations' | 'profile'

type NavItem = { tab: Tab; label: string }
type NavSection =
  | { type: 'standalone'; tab: Tab; label: string; ownerOnly: boolean }
  | { type: 'group'; label: string; ownerOnly: boolean; items: NavItem[] }

const NAV: NavSection[] = [
  { type: 'standalone', tab: 'dashboard', label: 'Dashboard', ownerOnly: true },
  {
    type: 'group', label: 'Studio Agent', ownerOnly: false,
    items: [
      { tab: 'chat',    label: 'Chat' },
      { tab: 'history', label: 'History' },
    ],
  },
  {
    type: 'group', label: 'Content Publishing', ownerOnly: false,
    items: [
      { tab: 'documents',    label: 'Documents' },
      { tab: 'compositions', label: 'Folio Layout' },
      { tab: 'videos',       label: 'Videos' },
    ],
  },
  {
    type: 'group', label: 'Job Tracking', ownerOnly: true,
    items: [
      { tab: 'resumes',      label: 'Resumes' },
      { tab: 'applications', label: 'Applications' },
      { tab: 'evidence',     label: 'Evidence' },
    ],
  },
  {
    type: 'group', label: 'Settings', ownerOnly: true,
    items: [
      { tab: 'sharing',      label: 'Sharing' },
      { tab: 'integrations', label: 'Integrations' },
      { tab: 'profile',      label: 'Profile' },
    ],
  },
]

function getAllTabs(isViewer: boolean): Tab[] {
  return NAV
    .filter((s) => !isViewer || !s.ownerOnly)
    .flatMap((s) => s.type === 'standalone' ? [s.tab] : s.items.map((i) => i.tab))
}

type RestoredConversation = {
  id: string
  title: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
} | null

type TokenBalance = { budget: number; used: number; remaining: number }

type Props = {
  isViewer?: boolean
  fullAccessSlug?: string       // set for demo folios — enables owner-only tabs for visitors
  initialBalance?: TokenBalance | null
  folioSlug?: string
  initialIsPublic?: boolean
  initialStudioIsPublic?: boolean
  initialInvites?: string[]
  initialStudioInvites?: string[]
  initialCalUsername?: string | null
  initialVideos?: FolioVideo[]
}

const TAB_META: Record<Tab, { short: string; detail: string }> = {
  dashboard: {
    short: 'Your job search and portfolio activity at a glance.',
    detail: 'A summary of your active application pipeline, recently updated applications, and placeholders for upcoming features: agent-triggered alerts and Cal.com calendar events.',
  },
  chat: {
    short: 'Draft content, manage documents, and control your portfolio with your AI assistant.',
    detail: `Your studio assistant has full context on your portfolio and can take real actions via tool calls. Ask it to write case studies, generate Mermaid diagrams, search existing content, save memories about people you've worked with, or publish compositions. It runs a ReAct loop — it reasons, calls tools, observes results, and reasons again — so complex multi-step tasks work in a single conversation. Everything it saves persists immediately to your portfolio.`,
  },
  history: {
    short: 'Browse and restore past conversations.',
    detail: `All chat sessions are saved automatically with a title derived from the first message. Conversations are listed newest-first. Click any entry to restore the full message history in the Chat tab — you can pick up exactly where you left off. Rename any conversation by clicking its title in the chat toolbar.`,
  },
  documents: {
    short: 'Encoded documents powering semantic search and AI context retrieval.',
    detail: `Every document you save — whether written in Chat or uploaded here — is chunked into overlapping segments, run through an embedding model, and stored as vectors in pgvector. This encoding is what makes semantic search work: the AI can find relevant context even when the query wording differs from the document text. The table shows all encoded chunks grouped by source file. Chunks, type, and creation date are all visible. You can upload new files, toggle published status on portfolio pieces, download raw Markdown, or delete documents to remove them from the context pool entirely.`,
  },
  compositions: {
    short: 'Build and publish pages by combining documents and other compositions.',
    detail: `A composition is a named, publishable page assembled from one or more source documents — and optionally from other compositions. When you hit Publish, Claude reads all the source material and generates a polished Markdown page in one pass. Compositions can nest: include another composition as an item and its compiled content is embedded inline. The Folio Page composition is special — its items determine which compositions appear as sections on your public portfolio page, and in what order. Use "Apply to folio" to push layout changes live without recompiling content.`,
  },
  videos: {
    short: 'Add YouTube videos to your folio — talks, demos, and walkthroughs.',
    detail: 'Paste any YouTube URL to pull in the title and thumbnail automatically. Added videos appear in a Talks & Videos section on your public folio page. Add a short description to give visitors context before they click.',
  },
  resumes: {
    short: 'Generate tailored resumes from job descriptions using your portfolio as source material.',
    detail: `Paste a job description or supply a URL — the builder fetches the posting, retrieves semantically relevant content from your portfolio via vector search, and asks Claude to write a resume that mirrors the job's language and requirements. Choose from four templates (Modern, Classic, Compact, Minimal). After generation, edit the markdown directly and print to PDF from the preview panel. Every resume is saved and can be restored, edited, or deleted at any time.`,
  },
  applications: {
    short: 'Track job applications, interviews, and conversations in one place.',
    detail: 'Log applications with company, role, status, applied date, and the resume you used. Attach a running timeline of events to each application — phone screens, technical rounds, behavioral interviews, offers, follow-ups, and freeform notes. Status flows from Applied → Screening → Interviewing → Offer → Accepted (or Rejected / Withdrawn / Ghosted). Your studio chat assistant can read and update applications; the public visitor chat cannot.',
  },
  evidence: {
    short: 'Generate a printable job search activity log for unemployment benefits.',
    detail: 'Select a date range to produce a printable log of every application submitted and every interview or contact recorded in that period — the kind of evidence unemployment insurance requires. The report is generated automatically from your Applications and Timeline data. Nothing needs to be entered separately.',
  },
  sharing: {
    short: 'Control who can see your folio.',
    detail: 'Public folios are visible to anyone with the link. Private folios are only visible to you when signed in. You can toggle this at any time — changes take effect immediately.',
  },
  integrations: {
    short: 'Connect external services so your AI assistant can take real-world actions.',
    detail: 'Connect Cal.com to enable meeting scheduling directly from the chat. When a Cal.com username is set, your assistant can generate pre-filled booking links for visitors. Without it, the scheduling capability is hidden from the assistant entirely.',
  },
  profile: {
    short: 'Manage your headshot and control whether it appears on your folio.',
    detail: 'Upload a photo, import your LinkedIn profile picture, or use AI to generate a professional headshot from your existing image. You get 3 AI generations per month. Toggle visibility to show or hide your headshot on your public folio page.',
  },
}

export default function StudioTabs({
  isViewer = false,
  fullAccessSlug,
  initialBalance,
  folioSlug,
  initialIsPublic,
  initialStudioIsPublic,
  initialInvites,
  initialStudioInvites,
  initialCalUsername,
  initialVideos,
}: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const tabParam     = searchParams.get('tab') as Tab | null
  // Full-access visitors see all tabs; regular viewers see only the viewer subset
  const visibleTabs  = getAllTabs(isViewer && !fullAccessSlug)
  const initialTab   = tabParam && visibleTabs.includes(tabParam) ? tabParam : (isViewer && !fullAccessSlug ? 'history' : 'chat')

  const [active,   setActive]   = useState<Tab>(initialTab)
  const [expanded, setExpanded] = useState(false)
  const [restoredConversation, setRestoredConversation] = useState<RestoredConversation>(null)

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
    const apiBase = isViewer && folioSlug ? `/api/folio-ai/${folioSlug}/studio` : '/api/studio'
    async function loadLatest() {
      try {
        const listRes = await fetch(`${apiBase}/conversations`)
        if (!listRes.ok || cancelled) return
        const { conversations } = await listRes.json()
        if (!conversations?.length || cancelled) return

        const convRes = await fetch(`${apiBase}/conversations/${conversations[0].id}`)
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
        // silently ignore — show greeting instead
      }
    }
    loadLatest()
    return () => { cancelled = true }
  }, [isViewer, folioSlug])

  function handleRename(id: string, title: string) {
    setRestoredConversation((prev) => prev?.id === id ? { ...prev, title } : prev)
  }

  function handleRestore(conv: StoredConversation) {
    setRestoredConversation({
      id: conv.id,
      title: conv.title,
      messages: (conv.messages ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>,
    })
    switchTab('chat')
  }

  const meta = TAB_META[active]
  const visibleNav = NAV.filter((s) => !isViewer || !!fullAccessSlug || !s.ownerOnly)

  return (
    <div className="flex h-full overflow-hidden">

      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-900/40 flex flex-col overflow-y-auto scrollbar-none print:hidden" style={{ scrollbarWidth: 'none' }}>
        <nav className="py-3">
          {visibleNav.map((section, si) => (
            <div key={si} className={si > 0 ? 'mt-1' : undefined}>
              {section.type === 'standalone' ? (
                <button
                  onClick={() => switchTab(section.tab)}
                  className={`w-full text-left text-[13px] font-medium px-4 py-2 transition-colors rounded-md mx-0 ${
                    active === section.tab
                      ? 'text-indigo-400 bg-indigo-950/40'
                      : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50'
                  }`}
                >
                  {section.label}
                </button>
              ) : (
                <>
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-4 pt-4 pb-1.5">
                    {section.label}
                  </div>
                  {section.items.map((item) => (
                    <button
                      key={item.tab}
                      onClick={() => switchTab(item.tab)}
                      className={`w-full text-left text-[13px] px-4 py-1.5 ml-2 transition-colors rounded-md ${
                        active === item.tab
                          ? 'text-indigo-400 bg-indigo-950/40'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                      style={{ width: 'calc(100% - 0.5rem)' }}
                    >
                      {item.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content pane */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Description strip */}
        <div className="shrink-0 border-b border-zinc-800/70 bg-zinc-900/30 px-4 py-2 print:hidden">
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
          {active === 'dashboard'    && <DashboardTab demoSlug={fullAccessSlug} />}
          {active === 'chat' && (
            <StudioChat
              restoredConversation={restoredConversation}
              onNewConversation={() => setRestoredConversation(null)}
              onRename={handleRename}
              initialBalance={initialBalance}
              isViewer={isViewer || !!fullAccessSlug}
            />
          )}
          {active === 'history' && (
            <ConversationHistory
              onRestore={handleRestore}
              folioSlug={isViewer || fullAccessSlug ? folioSlug : undefined}
              isViewer={isViewer || !!fullAccessSlug}
            />
          )}
          {active === 'documents'    && <DocumentsTable folioSlug={folioSlug} isViewer={isViewer || !!fullAccessSlug} />}
          {active === 'compositions' && <CompositionsTab folioSlug={folioSlug} isViewer={isViewer || !!fullAccessSlug} />}
          {active === 'sharing'      && folioSlug && (
            <SharingTab
              folioSlug={folioSlug}
              initialIsPublic={initialIsPublic ?? false}
              initialInvites={initialInvites ?? []}
              initialStudioIsPublic={initialStudioIsPublic ?? false}
              initialStudioInvites={initialStudioInvites ?? []}
            />
          )}
          {active === 'integrations' && folioSlug && (
            <IntegrationsTab folioSlug={folioSlug} initialCalUsername={initialCalUsername ?? null} />
          )}
          {active === 'videos'       && folioSlug && (
            <VideosTab folioSlug={folioSlug} initialVideos={initialVideos ?? []} isViewer={isViewer || !!fullAccessSlug} />
          )}
          {active === 'profile'      && <ProfileTab />}
          {active === 'resumes'      && <ResumeTab      demoSlug={fullAccessSlug} />}
          {active === 'applications' && <ApplicationsTab demoSlug={fullAccessSlug} />}
          {active === 'evidence'     && <EvidenceTab     demoSlug={fullAccessSlug} />}
        </div>
      </div>
    </div>
  )
}
