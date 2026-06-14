import { sql } from './db'
import { embedBatch } from './embeddings'

export type DocType = 'bio' | 'resume' | 'case-study' | 'architecture' | 'journal' | 'job-req' | 'memory' | 'connection' | 'diagram' | 'adr' | 'folio'

export function chunkText(text: string, maxChars = 600): string[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > maxChars && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export async function ingestDocument(
  type: DocType,
  title: string,
  source: string,
  content: string,
  ownerId = process.env.OWNER_ID ?? 'default',
  submittedBy?: string,
  metadata: Record<string, unknown> = {},
): Promise<{ chunks: number }> {
  const submitter = submittedBy ?? ownerId
  const chunks = chunkText(content)
  await sql`DELETE FROM documents WHERE source = ${source} AND owner_id = ${ownerId}`

  // Ensure only one baseline resume exists per owner
  if (metadata.is_baseline && type === 'resume') {
    await sql`
      UPDATE documents
      SET metadata = metadata - 'is_baseline'
      WHERE owner_id = ${ownerId} AND type = 'resume'
    `
  }

  const metadataJson = JSON.stringify(metadata)
  const embeddings = await embedBatch(chunks)
  for (let i = 0; i < chunks.length; i++) {
    const vector = `[${embeddings[i].join(',')}]`
    await sql`
      INSERT INTO documents (owner_id, submitted_by, type, title, source, content, embedding, metadata)
      VALUES (${ownerId}, ${submitter}, ${type}, ${title}, ${source}, ${chunks[i]}, ${vector}::vector, ${metadataJson}::jsonb)
    `
  }

  return { chunks: chunks.length }
}

