import { sql } from './db'
import { ingestDocument } from './ingest'

export async function upsertConnectionOnLogin(
  name: string,
  email: string,
  ownerId: string = process.env.OWNER_ID ?? 'default',
): Promise<void> {
  try {
    const existing = await sql`
      SELECT id FROM documents
      WHERE owner_id = ${ownerId}
        AND type = 'connection'
        AND metadata->>'email' = ${email}
      LIMIT 1
    `

    const now = new Date().toISOString()

    if (existing.length > 0) {
      // Bump visit count and last_seen without touching embeddings
      await sql`
        UPDATE documents
        SET metadata = jsonb_set(
          metadata || ${JSON.stringify({ last_seen: now })}::jsonb,
          '{visit_count}',
          to_jsonb(COALESCE((metadata->>'visit_count')::int, 0) + 1)
        )
        WHERE owner_id = ${ownerId}
          AND type = 'connection'
          AND metadata->>'email' = ${email}
      `
    } else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const source = `connection/${slug}`
      const content = `## ${name}\n\n**Email**: ${email}`
      await ingestDocument('connection', name, source, content, ownerId, ownerId, {
        email, name, visit_count: 1, last_seen: now,
      })
      console.log('[folio-ai new-connection]', JSON.stringify({ name, email, ownerId }))
    }
  } catch (err) {
    console.error('[folio-ai connection-upsert-error]', err instanceof Error ? err.message : err)
  }
}
