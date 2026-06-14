/**
 * folio.config.ts — configuration schema for folio-ai
 *
 * All personal values are read from environment variables.
 * Copy .env.local.example → .env.local and fill in your own values.
 * This file is safe to commit — it contains no personal data.
 */

const config = {
  owner: {
    name:     process.env.OWNER_NAME     ?? 'Your Name',
    title:    process.env.OWNER_TITLE    ?? 'Your Title',
    email:    process.env.OWNER_EMAIL    ?? 'you@example.com',
    location: process.env.OWNER_LOCATION ?? 'Your City',
    linkedin: process.env.OWNER_LINKEDIN ?? '#',
    github:   process.env.OWNER_GITHUB   ?? '#',
    domain:   process.env.OWNER_DOMAIN   ?? 'example.com',
  },

  site: {
    title:       process.env.SITE_TITLE       ?? 'folio-ai',
    description: process.env.SITE_DESCRIPTION ?? 'AI-native portfolio — architecture case studies and an embedded AI assistant.',
    url:         process.env.SITE_URL         || 'https://example.com',
  },

  agent: {
    assistantName: process.env.AGENT_NAME     ?? 'Portfolio Assistant',
    greeting:      process.env.AGENT_GREETING ?? "Hi — I can answer questions about this portfolio, or help you schedule time.",
    folioSlug:     process.env.FOLIO_SLUG     ?? '',
  },

  scheduling: {
    calUsername:      process.env.CAL_USERNAME      ?? '',
    defaultEventSlug: process.env.CAL_DEFAULT_EVENT ?? '30min',
  },
}

export type FolioConfig = typeof config
export default config
