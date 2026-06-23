import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { getFolioByOwnerId, getTokenBalance, consumeTokens } from '@/lib/folios'
import { retrieveRelevant } from '@/lib/rag'
import { listResumes, createResume, fetchJobDescription, type ResumeTemplate } from '@/lib/resumes'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

const TEMPLATE_INSTRUCTIONS: Record<ResumeTemplate, string> = {
  modern:  `Use a clean, modern format. Start with the candidate's name as a single # heading, then contact info as plain text on one line. Use ## for section headings (Summary, Experience, Education, Skills, etc.). Keep descriptions concise with bullet points. This is a contemporary, tech-forward style.`,
  classic: `Use a traditional chronological format. Name as # heading, then a centered-looking contact block. Sections: Objective or Summary, Professional Experience, Education, Skills, Certifications. Write in a formal, polished tone appropriate for corporate environments.`,
  compact: `Maximise content density. Use the candidate's name as # heading, then pack contact info tightly. Lead with a 2-sentence summary. Use short, punchy bullet points — no more than one line each. Combine related skills. Prefer breadth over depth. Every line must earn its place.`,
  minimal: `Use a plain, ATS-optimised format. Name as # heading, contact on one line, then sections with simple ## headings. Use plain hyphens for bullets. No decorative text, no jargon, no special characters beyond standard punctuation. Write for maximum keyword match and machine readability.`,
}

function buildSystemPrompt(template: ResumeTemplate): string {
  return `You are an expert resume writer. You tailor resumes to specific job descriptions using the candidate's actual experience and accomplishments.

${TEMPLATE_INSTRUCTIONS[template]}

Output format — start your response with exactly these three lines (fill in the brackets):
TITLE: [Role at Company]
COMPANY: [Company name only]
ROLE: [Job title only]
---
[Full resume in Markdown follows here]

Rules:
- Only include experience and skills that appear in the provided portfolio context
- Quantify accomplishments where the context supports it
- Mirror keywords from the job description naturally
- Do not invent facts, titles, dates, or metrics
- The resume should be complete and ready to use`
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const resumes = await listResumes(ownerId)
  return Response.json({ resumes })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })

  const folio = await getFolioByOwnerId(ownerId)
  if (!folio) return Response.json({ error: 'no_folio' }, { status: 404 })

  const body = await req.json() as {
    job_description?: string; job_url?: string; template?: ResumeTemplate; title?: string
  }

  const template: ResumeTemplate = body.template ?? 'modern'
  const jobUrl = body.job_url?.trim() || null
  let jobDescription = body.job_description?.trim() ?? ''

  if (!jobDescription && !jobUrl) {
    return Response.json({ error: 'job_description or job_url is required' }, { status: 400 })
  }

  if (jobUrl && !jobDescription) {
    try {
      jobDescription = await fetchJobDescription(jobUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch job URL'
      return Response.json({ error: msg }, { status: 422 })
    }
  }

  if (!jobDescription) {
    return Response.json({ error: 'Could not extract job description' }, { status: 422 })
  }

  const balance = await getTokenBalance(ownerId)
  if (balance.remaining <= 0) {
    return Response.json({ error: 'budget_exceeded', budget: balance }, { status: 402 })
  }

  const chunks = await retrieveRelevant(jobDescription, ownerId, 12, 0.25, ['job-req'])
  const contextBlock = chunks.length > 0
    ? chunks.map((c) => `## ${c.title} (${c.type})\n${c.content}`).join('\n\n---\n\n')
    : '(No portfolio documents found — write based on the job description alone.)'

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'AI generation is not configured' }, { status: 503 })
  }

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: buildSystemPrompt(template),
    messages: [
      {
        role: 'user',
        content: `## Job Description\n\n${jobDescription}\n\n---\n\n## Portfolio Context\n\n${contextBlock}`,
      },
    ],
  })

  const totalTokens = (message.usage.input_tokens ?? 0) + (message.usage.output_tokens ?? 0)
  consumeTokens(ownerId, totalTokens).catch(() => {})

  const raw = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const titleMatch   = raw.match(/^TITLE:\s*(.+)$/m)
  const companyMatch = raw.match(/^COMPANY:\s*(.+)$/m)
  const roleMatch    = raw.match(/^ROLE:\s*(.+)$/m)
  const divider      = raw.indexOf('\n---\n')

  const title   = titleMatch?.[1]?.trim()   ?? (body.title ?? 'Resume')
  const company = companyMatch?.[1]?.trim() ?? null
  const role    = roleMatch?.[1]?.trim()    ?? null
  const content = divider >= 0 ? raw.slice(divider + 5).trim() : raw

  const resume = await createResume({ ownerId, folioId: folio.id, title, company, role, jobUrl, jobDescription, template, content })
  return Response.json({ resume }, { status: 201 })
}
