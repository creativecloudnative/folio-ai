import { sql } from './db'
import { upsertConnectionOnLogin } from './connections'

export type Folio = {
  id: string
  owner_id: string
  slug: string
  name: string
  email: string
  is_public: boolean
  token_budget: number
  tokens_used: number
  created_at: string
}

export type TokenBalance = {
  budget: number
  used: number
  remaining: number
}

const DEFAULT_TOKEN_BUDGET = 100_000

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS folios (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id      TEXT         NOT NULL UNIQUE,
      slug          TEXT         NOT NULL UNIQUE,
      name          TEXT         NOT NULL,
      email         TEXT         NOT NULL UNIQUE,
      is_public     BOOLEAN      NOT NULL DEFAULT FALSE,
      token_budget  INTEGER      NOT NULL DEFAULT 100000,
      tokens_used   INTEGER      NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `
  // Add column to existing tables that predate this field
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE`
  // Creator's folio is always public — identified by OWNER_EMAIL which is always set
  const creatorEmail = process.env.OWNER_EMAIL ?? ''
  if (creatorEmail) {
    await sql`UPDATE folios SET is_public = TRUE WHERE email = ${creatorEmail} AND is_public = FALSE`
  }
}

export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(base: string): Promise<string> {
  const rows = await sql`SELECT slug FROM folios WHERE slug LIKE ${base + '%'}`
  const existing = new Set((rows as { slug: string }[]).map((r) => r.slug))
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function upsertFolioOnLogin(
  ownerId: string,
  name: string,
  email: string,
): Promise<Folio> {
  await ensureTable()

  const existing = await sql`
    SELECT id, owner_id, slug, name, email, is_public, token_budget, tokens_used, created_at
    FROM folios WHERE owner_id = ${ownerId} LIMIT 1
  `
  if (existing.length > 0) return existing[0] as Folio

  const slug = await uniqueSlug(nameToSlug(name))
  const rows = await sql`
    INSERT INTO folios (owner_id, slug, name, email)
    VALUES (${ownerId}, ${slug}, ${name}, ${email})
    RETURNING id, owner_id, slug, name, email, is_public, token_budget, tokens_used, created_at
  `
  console.log('[folio-ai new-folio]', JSON.stringify({ slug, name, email }))

  // Seed a self-profile connection doc in the new user's own folio
  upsertConnectionOnLogin(name, email, ownerId).catch(() => {})

  return rows[0] as Folio
}

export async function getFolioBySlug(slug: string): Promise<Folio | null> {
  await ensureTable()
  const rows = await sql`
    SELECT id, owner_id, slug, name, email, is_public, token_budget, tokens_used, created_at
    FROM folios WHERE slug = ${slug} LIMIT 1
  `
  return (rows[0] as Folio) ?? null
}

export async function getFolioByOwnerId(ownerId: string): Promise<Folio | null> {
  await ensureTable()
  const rows = await sql`
    SELECT id, owner_id, slug, name, email, is_public, token_budget, tokens_used, created_at
    FROM folios WHERE owner_id = ${ownerId} LIMIT 1
  `
  return (rows[0] as Folio) ?? null
}

export async function getAllFolios(): Promise<Folio[]> {
  await ensureTable()
  const rows = await sql`
    SELECT id, owner_id, slug, name, email, is_public, token_budget, tokens_used, created_at
    FROM folios ORDER BY created_at DESC
  `
  return rows as Folio[]
}

export async function getTokenBalance(ownerId: string): Promise<TokenBalance> {
  const rows = await sql`
    SELECT token_budget, tokens_used FROM folios WHERE owner_id = ${ownerId} LIMIT 1
  `
  if (rows.length === 0) return { budget: DEFAULT_TOKEN_BUDGET, used: 0, remaining: DEFAULT_TOKEN_BUDGET }
  const { token_budget, tokens_used } = rows[0] as { token_budget: number; tokens_used: number }
  return {
    budget: token_budget,
    used: tokens_used,
    remaining: Math.max(0, token_budget - tokens_used),
  }
}

export type AdminDocument = {
  owner_id: string
  owner_name: string
  owner_slug: string
  owner_email: string
  type: string
  title: string
  source: string
  chunk_count: number
  created_at: string
}

export async function getAllDocumentsForAdmin(): Promise<AdminDocument[]> {
  const rows = await sql`
    SELECT
      d.owner_id,
      COALESCE(f.name,  d.owner_id) AS owner_name,
      COALESCE(f.slug,  '')         AS owner_slug,
      COALESCE(f.email, '')         AS owner_email,
      d.type,
      d.title,
      d.source,
      COUNT(*)::int                 AS chunk_count,
      MIN(d.created_at)             AS created_at
    FROM documents d
    LEFT JOIN folios f ON f.owner_id = d.owner_id
    GROUP BY d.owner_id, f.name, f.slug, f.email, d.type, d.title, d.source
    ORDER BY f.name, d.type, MIN(d.created_at) DESC
  `
  return rows as AdminDocument[]
}

export async function setFolioVisibility(ownerId: string, isPublic: boolean): Promise<void> {
  await sql`UPDATE folios SET is_public = ${isPublic} WHERE owner_id = ${ownerId}`
}

export async function consumeTokens(ownerId: string, amount: number): Promise<void> {
  await sql`
    UPDATE folios SET tokens_used = tokens_used + ${amount} WHERE owner_id = ${ownerId}
  `
}
