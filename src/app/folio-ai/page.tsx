import Link from 'next/link'
import { auth } from '@/auth'
import { nameToSlug } from '@/lib/folios'
import config from '../../../folio.config'
import SignInButton from '@/components/SignInButton'

export const metadata = {
  title: 'folio-ai — AI-native portfolios for engineers',
  description:
    'Turn your architecture work into a living portfolio. An AI assistant that knows your work, answers recruiter questions, and schedules meetings.',
}

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'AI Assistant',
    description:
      'A ReAct-style agent trained on your work. It answers recruiter questions, surfaces relevant case studies, schedules meetings, and takes notes — all without you lifting a finger.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
    title: 'Content Studio',
    description:
      'An AI-powered studio for documenting your work. Walk the assistant through a project and it structures it into a polished case study or architecture design.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    title: 'Semantic Search',
    description:
      'Visitors ask natural language questions and get answers grounded in your actual work. "Show me projects involving Kubernetes and cost optimization" just works.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    title: 'Architecture-first',
    description:
      'Case studies and architecture designs are first-class content types with Mermaid diagram support, publish controls, and semantic indexing built in.',
  },
]

export default async function FolioHomePage() {
  const session = await auth()
  const folioSlug = session?.user?.folioSlug
  const creatorSlug = nameToSlug(config.owner.name)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-sm font-semibold tracking-wide text-white">folio-ai</span>
        <div className="flex items-center gap-4">
          <Link
            href={`/folio-ai/${creatorSlug}`}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            See example
          </Link>
          <a
            href="https://github.com/creativecloudnative/folio-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            GitHub
          </a>
          {folioSlug ? (
            <Link
              href={`/folio-ai/${folioSlug}`}
              className="text-sm px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              My folio
            </Link>
          ) : (
            <SignInButton className="text-sm px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              Sign in
            </SignInButton>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-900/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-cyan-900/10 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-700/50 bg-indigo-900/20 text-xs text-indigo-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Open source · MIT licensed
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            The portfolio that
            <br />
            <span className="text-indigo-400">talks back</span>
          </h1>

          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            An AI-native portfolio for engineers. Document your architecture work, publish it, and
            let a built-in AI assistant answer questions about your experience — 24/7.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {folioSlug ? (
              <Link
                href={`/folio-ai/${folioSlug}`}
                className="px-6 py-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                Go to my folio →
              </Link>
            ) : (
              <SignInButton className="px-6 py-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
                Create your folio
              </SignInButton>
            )}
            <Link
              href={`/folio-ai/${creatorSlug}`}
              className="px-6 py-3 rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium transition-colors"
            >
              See it live
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t border-zinc-800/60">
        <p className="text-sm font-mono text-indigo-400 mb-3 tracking-widest uppercase text-center">
          What you get
        </p>
        <h2 className="text-3xl font-bold text-white mb-12 text-center">
          Everything a senior engineer needs
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t border-zinc-800/60">
        <p className="text-sm font-mono text-indigo-400 mb-3 tracking-widest uppercase text-center">
          How it works
        </p>
        <h2 className="text-3xl font-bold text-white mb-12 text-center">
          Three steps to a living portfolio
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Sign in with LinkedIn',
              body: 'Your folio is created instantly. No setup forms, no config files — your portfolio is live in seconds.',
            },
            {
              step: '02',
              title: 'Document your work',
              body: 'Use the AI-powered studio to walk through your projects. The assistant structures everything into polished case studies.',
            },
            {
              step: '03',
              title: 'Share and let it work',
              body: 'Send recruiters your folio URL. The built-in AI answers their questions, surfaces your best work, and books meetings for you.',
            },
          ].map((s) => (
            <div key={s.step} className="relative pl-12">
              <span className="absolute left-0 top-0 text-4xl font-bold text-zinc-800 leading-none select-none">
                {s.step}
              </span>
              <h3 className="text-base font-semibold text-white mb-2 pt-1">{s.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t border-zinc-800/60">
        <div className="rounded-2xl border border-indigo-800/40 bg-indigo-900/10 px-8 py-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            See the real thing
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto mb-8">
            This site is built with folio-ai. Ask the assistant about the creator&apos;s work,
            browse the architecture designs, or fork the repo and make it yours.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/folio-ai/${creatorSlug}`}
              className="px-6 py-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              Visit creator&apos;s folio →
            </Link>
            <a
              href="https://github.com/creativecloudnative/folio-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium transition-colors"
            >
              Fork on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-8 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>folio-ai — open source, MIT licensed</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <a href="https://github.com/creativecloudnative/folio-ai" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
            <Link href={`/folio-ai/${creatorSlug}`} className="hover:text-zinc-400 transition-colors">Example folio</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
