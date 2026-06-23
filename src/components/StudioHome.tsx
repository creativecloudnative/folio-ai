'use client'

type Tab =
  | 'home'
  | 'dashboard'
  | 'chat' | 'history'
  | 'documents' | 'compositions' | 'videos'
  | 'resumes' | 'applications' | 'evidence'
  | 'sharing' | 'integrations' | 'profile'

type Props = {
  switchTab: (tab: Tab) => void
  isViewer?: boolean
  folioName?: string
}

type FeatureCard = {
  title: string
  description: string
  action: string
  tab: Tab
  ownerOnly?: boolean
}

const CARDS: FeatureCard[] = [
  {
    title: 'Studio Agent',
    description: 'Your AI assistant has full context on your portfolio and can take real actions — write case studies, generate Mermaid diagrams, save documents, and publish compositions. Ask it anything.',
    action: 'Open Chat',
    tab: 'chat',
  },
  {
    title: 'Portfolio Content',
    description: 'Upload and manage documents that power semantic search. Assemble compositions that become the published sections of your public folio page.',
    action: 'Manage Documents',
    tab: 'documents',
  },
  {
    title: 'Job Tracking',
    description: 'Generate tailored resumes from job descriptions using your portfolio as source material. Track applications, log interviews, and maintain a searchable activity log.',
    action: 'View Dashboard',
    tab: 'dashboard',
    ownerOnly: true,
  },
  {
    title: 'Settings',
    description: 'Control folio visibility, connect Cal.com to enable meeting scheduling from the chat, and manage your profile headshot.',
    action: 'Open Settings',
    tab: 'sharing',
    ownerOnly: true,
  },
]

export default function StudioHome({ switchTab, isViewer, folioName }: Props) {
  const visibleCards = CARDS.filter((c) => !c.ownerOnly || !isViewer)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {folioName ? `${folioName}'s Studio` : 'Design Studio'}
          </h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-lg">
            Your AI-native portfolio workspace. Chat with your studio agent, manage content, and track your job search — all in one place.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleCards.map((card) => (
            <button
              key={card.tab}
              onClick={() => switchTab(card.tab)}
              className="group text-left rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/70 p-5 transition-all"
            >
              <h2 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                {card.title}
              </h2>
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                {card.description}
              </p>
              <span className="mt-4 inline-block text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">
                {card.action} →
              </span>
            </button>
          ))}
        </div>

        {/* Chat history shortcut */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-300">Conversation history</p>
            <p className="text-xs text-zinc-500 mt-0.5">Browse and restore past sessions with your studio agent.</p>
          </div>
          <button
            onClick={() => switchTab('history')}
            className="shrink-0 text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors whitespace-nowrap"
          >
            View history
          </button>
        </div>

      </div>
    </div>
  )
}
