import config from '../../../folio.config'
import { retrieveRelevant, fetchBaselineResume, formatChunksForPrompt } from '@/lib/rag'
import { sendNoteToOwner } from '@/lib/email'

type AuthSession = {
  user?: {
    name?: string | null
    email?: string | null
  }
} | null

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  session: AuthSession,
): Promise<string> {
  switch (name) {
    case 'send_note': {
      const subject = input.subject as string
      const message = input.message as string
      const visitorName = session?.user?.name ?? 'A visitor'
      const visitorEmail = session?.user?.email

      if (!visitorEmail) {
        return 'Unable to send — no email address found on your LinkedIn profile.'
      }

      try {
        await sendNoteToOwner({ visitorName, visitorEmail, subject, message })
        console.log('[folio-ai note-sent]', JSON.stringify({
          timestamp: new Date().toISOString(),
          from: visitorEmail,
          name: visitorName,
          subject,
        }))
        return `Your note has been sent to ${config.owner.name}. He'll receive it at his email with your address as the reply-to, so he can respond directly.`
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[folio-ai note-error]', msg)
        return `Sorry, the note couldn't be delivered right now (${msg}). You can reach ${config.owner.name} directly at ${config.owner.email}.`
      }
    }

    case 'analyze_job_fit': {
      const jobDescription = input.job_description as string
      const jobTitle = input.job_title as string | undefined
      const company = input.company as string | undefined
      const ownerId = process.env.OWNER_ID ?? 'default'

      // Always include the full baseline resume — similarity search alone may miss
      // relevant experience that doesn't lexically overlap with the job description
      const baseline = await fetchBaselineResume(ownerId)

      // Supplement with similarity results from non-resume content (case studies, bio, journal)
      const supplementary = await retrieveRelevant(jobDescription, ownerId, 8, 0.35, ['job-req', 'resume'])

      const allChunks = [...baseline, ...supplementary]
      if (allChunks.length === 0) {
        return 'No portfolio content found. Ask the owner to upload a baseline resume from the Content Studio before running fit analysis.'
      }

      // Notify owner automatically — no separate tool call needed
      console.log('[folio-ai job-fit]', JSON.stringify({
        timestamp: new Date().toISOString(),
        visitor: session?.user?.name ?? 'Unknown',
        visitorEmail: session?.user?.email ?? null,
        jobTitle: jobTitle ?? null,
        company: company ?? null,
      }))

      const sections: string[] = []
      if (baseline.length > 0) {
        sections.push(`## Baseline Resume\n\n${formatChunksForPrompt(baseline)}`)
      } else {
        sections.push('## Baseline Resume\n\n_No baseline resume designated. Using similarity search only._')
      }
      if (supplementary.length > 0) {
        sections.push(`## Relevant Case Studies & Other Content\n\n${formatChunksForPrompt(supplementary)}`)
      }
      return sections.join('\n\n')
    }

    case 'schedule_meeting': {
      const topic = input.topic as string | undefined
      const calUsername = process.env.CAL_USERNAME ?? config.scheduling.calUsername
      const baseUrl = `https://cal.com/${calUsername}/${config.scheduling.defaultEventSlug}`

      const params = new URLSearchParams()
      if (session?.user?.name) params.set('name', session.user.name)
      if (session?.user?.email) params.set('email', session.user.email)
      if (topic) params.set('notes', topic)
      const query = params.toString()
      const url = query ? `${baseUrl}?${query}` : baseUrl

      // Record LinkedIn identity server-side at the moment of intent —
      // this is the verified identity regardless of what they type into Cal.com
      console.log('[folio-ai booking-intent]', JSON.stringify({
        timestamp: new Date().toISOString(),
        name: session?.user?.name ?? null,
        email: session?.user?.email ?? null,
        topic: topic ?? null,
      }))

      const visitorName = session?.user?.name ?? 'you'
      return `Here's a booking link for ${visitorName}: ${url}\n\nYour name and email are pre-filled from your LinkedIn profile. Just pick a time and confirm.`
    }

    case 'take_note': {
      const note: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        visitor: session?.user?.name ?? 'Anonymous',
        visitorEmail: session?.user?.email ?? (input.email as string | undefined) ?? null,
        interest: input.interest,
      }
      if (input.name) note.name = input.name
      if (input.notes) note.notes = input.notes
      // Phase 4: log to server console. Phase 6: write to database.
      console.log('[folio-ai lead]', JSON.stringify(note, null, 2))
      return `Got it — I've noted your interest and Clint will be in touch. In the meantime, you can also reach him directly at ${config.owner.email} or grab a calendar slot if you'd like to chat sooner.`
    }

    default:
      return `Unknown tool: ${name}`
  }
}
