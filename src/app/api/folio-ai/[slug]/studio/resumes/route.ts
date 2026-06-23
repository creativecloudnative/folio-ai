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

export async function POST() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}
