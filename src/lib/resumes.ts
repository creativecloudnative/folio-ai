import { sql } from './db'

export type ResumeTemplate = 'modern' | 'classic' | 'compact' | 'minimal'

export const RESUME_TEMPLATES: Record<ResumeTemplate, { label: string; description: string }> = {
  modern:   { label: 'Modern',   description: 'Clean sans-serif, indigo accents, generous whitespace' },
  classic:  { label: 'Classic',  description: 'Serif, traditional layout, recruiter-friendly' },
  compact:  { label: 'Compact',  description: 'Dense, maximises content per page' },
  minimal:  { label: 'Minimal',  description: 'Plain, ATS-optimised, no decoration' },
}

export type Resume = {
  id: string
  owner_id: string
  folio_id: string
  title: string
  company: string | null
  role: string | null
  job_url: string | null
  job_description: string
  template: ResumeTemplate
  content: string
  created_at: Date
  updated_at: Date
}

export async function listResumes(ownerId: string): Promise<Resume[]> {
  const rows = await sql`
    SELECT * FROM resumes
    WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC
  `
  return rows as unknown as Resume[]
}

export async function getResume(id: string, ownerId: string): Promise<Resume | null> {
  const rows = await sql`
    SELECT * FROM resumes WHERE id = ${id} AND owner_id = ${ownerId}
  `
  return (rows[0] as unknown as Resume) ?? null
}

export async function createResume(data: {
  ownerId: string
  folioId: string
  title: string
  company: string | null
  role: string | null
  jobUrl: string | null
  jobDescription: string
  template: ResumeTemplate
  content: string
}): Promise<Resume> {
  const rows = await sql`
    INSERT INTO resumes (owner_id, folio_id, title, company, role, job_url, job_description, template, content)
    VALUES (
      ${data.ownerId}, ${data.folioId}, ${data.title}, ${data.company}, ${data.role},
      ${data.jobUrl}, ${data.jobDescription}, ${data.template}, ${data.content}
    )
    RETURNING *
  `
  return rows[0] as unknown as Resume
}

export async function updateResume(
  id: string,
  ownerId: string,
  patch: { content?: string; title?: string; template?: ResumeTemplate },
): Promise<Resume | null> {
  const rows = await sql`
    UPDATE resumes
    SET
      content  = COALESCE(${patch.content  ?? null}, content),
      title    = COALESCE(${patch.title    ?? null}, title),
      template = COALESCE(${patch.template ?? null}, template),
      updated_at = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING *
  `
  return (rows[0] as unknown as Resume) ?? null
}

export async function deleteResume(id: string, ownerId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM resumes WHERE id = ${id} AND owner_id = ${ownerId} RETURNING id
  `
  return rows.length > 0
}

// ── Job URL fetching ───────────────────────────────────────────────────────────

export async function fetchJobDescription(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; folio-ai/1.0 +https://creativecloudnative.com)' },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`)

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error('URL did not return an HTML page')
  }

  const html = await res.text()
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  // Cap at 8 000 chars to avoid token overflow in the generation prompt
  return text.slice(0, 8000)
}
