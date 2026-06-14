import { sql } from './db'
import { embed } from './embeddings'

export type DocumentChunk = {
  id: string
  type: string
  title: string
  source: string
  content: string
  similarity: number
  metadata?: Record<string, unknown>
}

export async function retrieveRelevant(
  query: string,
  ownerId = process.env.OWNER_ID ?? 'default',
  limit = 8,
  threshold = 0.3,
  excludeTypes: string[] = ['job-req'],
): Promise<DocumentChunk[]> {
  const embedding = await embed(query)
  const vector = `[${embedding.join(',')}]`

  const rows = await sql`
    SELECT id, type, title, content,
           1 - (embedding <=> ${vector}::vector) AS similarity
    FROM documents
    WHERE owner_id = ${ownerId}
      AND type != ALL(${excludeTypes})
      AND 1 - (embedding <=> ${vector}::vector) > ${threshold}
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${limit}
  `

  return rows as DocumentChunk[]
}

export async function fetchMemoriesForVisitor(
  email: string | null,
  name: string | null,
  ownerId = process.env.OWNER_ID ?? 'default',
): Promise<DocumentChunk[]> {
  // Email is the only identity anchor — LinkedIn OAuth provides a verified email
  // on every login, so there is no safe reason to fall back to name alone.
  // A memory without a matching email will never surface, regardless of name.
  if (!email) return []

  const emailJson = JSON.stringify([{ email }])
  const rows = await sql`
    SELECT id, type, title, source, content, 1.0 AS similarity
    FROM documents
    WHERE owner_id = ${ownerId}
      AND type = 'memory'
      AND (metadata->'people') @> ${emailJson}::jsonb
    ORDER BY source, created_at
  `
  return rows as DocumentChunk[]
}

export async function fetchConnectionForVisitor(
  email: string | null,
  ownerId = process.env.OWNER_ID ?? 'default',
): Promise<DocumentChunk | null> {
  if (!email) return null

  const rows = await sql`
    SELECT id, type, title, source, content, metadata, 1.0 AS similarity
    FROM documents
    WHERE owner_id = ${ownerId}
      AND type = 'connection'
      AND metadata->>'email' = ${email}
    ORDER BY created_at DESC
    LIMIT 1
  `
  return (rows[0] as DocumentChunk) ?? null
}

export async function fetchBaselineResume(
  ownerId = process.env.OWNER_ID ?? 'default',
): Promise<DocumentChunk[]> {
  const rows = await sql`
    SELECT id, type, title, content,
           1.0 AS similarity
    FROM documents
    WHERE owner_id = ${ownerId}
      AND type = 'resume'
      AND metadata->>'is_baseline' = 'true'
    ORDER BY created_at ASC
  `
  return rows as DocumentChunk[]
}

export function formatChunksForPrompt(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) return ''
  return chunks
    .map((c) => `### ${c.title} (${c.type})\n${c.content}`)
    .join('\n\n')
}
