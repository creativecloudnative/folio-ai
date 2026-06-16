import { sql } from './db'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS studio_invites (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      folio_id   UUID        NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
      email      TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(folio_id, email)
    )
  `
}

export async function getStudioInvites(folioId: string): Promise<string[]> {
  await ensureTable()
  const rows = await sql`SELECT email FROM studio_invites WHERE folio_id = ${folioId} ORDER BY created_at`
  return (rows as { email: string }[]).map((r) => r.email)
}

export async function addStudioInvite(folioId: string, email: string): Promise<void> {
  await ensureTable()
  await sql`INSERT INTO studio_invites (folio_id, email) VALUES (${folioId}, ${email}) ON CONFLICT DO NOTHING`
}

export async function removeStudioInvite(folioId: string, email: string): Promise<void> {
  await sql`DELETE FROM studio_invites WHERE folio_id = ${folioId} AND email = ${email}`
}

export async function isStudioInvited(folioId: string, email: string): Promise<boolean> {
  await ensureTable()
  const rows = await sql`SELECT 1 FROM studio_invites WHERE folio_id = ${folioId} AND email = ${email} LIMIT 1`
  return rows.length > 0
}
