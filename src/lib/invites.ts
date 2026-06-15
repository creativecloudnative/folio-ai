import { sql } from '@/lib/db'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS folio_invites (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      folio_id    UUID        NOT NULL,
      email       TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (folio_id, email)
    )
  `
}

export async function getFolioInvites(folioId: string): Promise<string[]> {
  await ensureTable()
  const rows = await sql`
    SELECT email FROM folio_invites
    WHERE folio_id = ${folioId}
    ORDER BY created_at ASC
  `
  return rows.map(r => r.email as string)
}

export async function addFolioInvite(folioId: string, email: string): Promise<void> {
  await ensureTable()
  const normalized = email.toLowerCase().trim()
  await sql`
    INSERT INTO folio_invites (folio_id, email)
    VALUES (${folioId}, ${normalized})
    ON CONFLICT (folio_id, email) DO NOTHING
  `
}

export async function removeFolioInvite(folioId: string, email: string): Promise<void> {
  await ensureTable()
  const normalized = email.toLowerCase().trim()
  await sql`DELETE FROM folio_invites WHERE folio_id = ${folioId} AND email = ${normalized}`
}

export async function isFolioInvited(folioId: string, email: string): Promise<boolean> {
  await ensureTable()
  const normalized = email.toLowerCase().trim()
  const rows = await sql`
    SELECT 1 FROM folio_invites
    WHERE folio_id = ${folioId} AND email = ${normalized}
    LIMIT 1
  `
  return rows.length > 0
}
