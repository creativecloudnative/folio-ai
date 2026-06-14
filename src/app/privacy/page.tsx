import Link from 'next/link'
import config from '../../../folio.config'

export const metadata = {
  title: 'Privacy Policy — folio-ai',
}

export default function PrivacyPage() {
  const updated = 'June 2026'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-10 inline-block"
        >
          ← Back
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mb-10">Last updated: {updated}</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-400">
          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">What this site is</h2>
            <p>
              This is {config.owner.name}&apos;s personal AI-powered portfolio, built with{' '}
              <a
                href="https://github.com/creativecloudnative/folio-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                folio-ai
              </a>
              , an open-source template. It includes an AI chat assistant that visitors can use to
              ask questions about {config.owner.name}&apos;s background and experience.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">What we collect</h2>
            <p className="mb-3">
              When you sign in with LinkedIn, we receive the following from LinkedIn&apos;s OAuth
              service:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your full name</li>
              <li>Your email address (primary LinkedIn email)</li>
              <li>Your profile photo URL</li>
            </ul>
            <p className="mt-3">
              We never receive or store your LinkedIn password or any other LinkedIn profile data.
              LinkedIn controls what is shared — you can review their data practices at{' '}
              <a
                href="https://www.linkedin.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                linkedin.com/legal/privacy-policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">How we use it</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <span className="text-slate-300">Identity</span> — your name and email identify
                you across sessions so the AI assistant can greet you by name and remember shared
                context.
              </li>
              <li>
                <span className="text-slate-300">Personalisation</span> — if {config.owner.name}{' '}
                has noted anything about you (e.g. how you know each other), the assistant uses
                that context to make the conversation more relevant.
              </li>
              <li>
                <span className="text-slate-300">Conversation history</span> — messages you send
                to the AI assistant may be saved so the owner can review visitor interest and
                improve the site.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">What we never do</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Sell or share your data with third parties</li>
              <li>Use your data for advertising</li>
              <li>Store your LinkedIn credentials</li>
              <li>Access any LinkedIn data beyond name, email, and profile photo</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">Data storage</h2>
            <p>
              Your name, email, and any saved conversation context are stored in a private
              PostgreSQL database. This data is not publicly visible. You can request deletion of
              your data at any time by contacting {config.owner.name} directly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">Contact</h2>
            <p>
              Questions about your data? Reach out at{' '}
              <a
                href={`mailto:${config.owner.email}`}
                className="text-indigo-400 hover:text-indigo-300"
              >
                {config.owner.email}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">Open source</h2>
            <p>
              This site&apos;s code is{' '}
              <a
                href="https://github.com/creativecloudnative/folio-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                publicly available on GitHub
              </a>
              . You can verify exactly what data is collected and how it is handled.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
