import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getFolioBySlug } from '@/lib/folios'
import config from '../../../../../folio.config'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const folio = await getFolioBySlug(slug)
  if (!folio) return {}
  return {
    title: `What can ${config.agent.assistantName} do? — ${folio.name}`,
    description: `Capabilities and example questions for the AI assistant on ${folio.name}'s portfolio.`,
  }
}

export default async function AssistantCapabilitiesPage({ params }: Props) {
  const { slug } = await params
  const folio = await getFolioBySlug(slug)
  if (!folio) notFound()

  const ownerName = folio.name ?? config.owner.name
  const assistantName = config.agent.assistantName

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Back link */}
        <Link
          href={`/folio-ai/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-10"
        >
          ← Back to portfolio
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 text-xs text-indigo-400 border border-indigo-800/50 bg-indigo-950/30 rounded-full px-3 py-1 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI Assistant
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-3">
            What can {assistantName} do?
          </h1>
          <p className="text-zinc-400 leading-relaxed">
            {assistantName} is the AI assistant built into {ownerName}&apos;s portfolio. It has deep context on
            {ownerName}&apos;s background, experience, and work — and can take real actions on your behalf.
          </p>
        </div>

        {/* Capabilities */}
        <div className="space-y-8">

          <section>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Answer questions</h2>
            <div className="space-y-2">
              {[
                `What's ${ownerName}'s experience with Kubernetes?`,
                'What cloud platforms has he worked on?',
                'Has he led any platform or infrastructure teams?',
                'What industries has he worked in?',
                'Does he have experience with AI or ML systems?',
                'What certifications does he hold?',
              ].map((q) => (
                <div key={q} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                  <span className="text-indigo-500 shrink-0 mt-0.5">?</span>
                  <span className="text-sm text-zinc-300">{q}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Schedule a meeting</h2>
            <p className="text-sm text-zinc-500 mb-3">
              Tell the assistant what you&apos;d like to discuss and it will generate a booking link for a time that works for you.
            </p>
            <div className="space-y-2">
              {[
                "I'd like to schedule a call to discuss a potential opportunity.",
                "Can we set up time to talk about a consulting engagement?",
                "I want to chat about an architecture review — can you help me book time?",
              ].map((q) => (
                <div key={q} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                  <span className="text-emerald-500 shrink-0 mt-0.5">→</span>
                  <span className="text-sm text-zinc-300">{q}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Send a message</h2>
            <p className="text-sm text-zinc-500 mb-3">
              Don&apos;t need a full meeting? The assistant can send a direct message to {ownerName} on your behalf.
            </p>
            <div className="space-y-2">
              {[
                "Can you pass along that I'm interested in the open Solutions Architect role at our company?",
                `I'd love to get ${ownerName}'s take on our Kubernetes migration — can you send him a note?`,
                "Just wanted to say the case studies were impressive — please let him know.",
              ].map((q) => (
                <div key={q} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                  <span className="text-violet-500 shrink-0 mt-0.5">✉</span>
                  <span className="text-sm text-zinc-300">{q}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Job fit analysis</h2>
            <p className="text-sm text-zinc-500 mb-3">
              Recruiting for a role? Paste the job description and {assistantName} will run an honest fit analysis against {ownerName}&apos;s background — matches, gaps, and overall assessment.
            </p>
            <div className="space-y-2">
              {[
                "Here's the JD for a Staff Solutions Architect role we're hiring for — how well does he fit?",
                "We're looking for someone with AI platform experience. Can you check the fit? [paste JD]",
              ].map((q) => (
                <div key={q} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                  <span className="text-amber-500 shrink-0 mt-0.5">⚡</span>
                  <span className="text-sm text-zinc-300">{q}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-400 mb-2">
            Ready to try it?
          </p>
          <Link
            href={`/folio-ai/${slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Open the chat on {ownerName}&apos;s portfolio →
          </Link>
        </div>

      </div>
    </div>
  )
}
