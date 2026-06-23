import { sql } from './db'
import { upsertConnectionOnLogin } from './connections'

export type Folio = {
  id: string
  owner_id: string
  slug: string
  name: string
  email: string
  is_public: boolean
  studio_is_public: boolean
  studio_full_access: boolean
  token_budget: number
  tokens_used: number
  cal_username: string | null
  headshot_url: string | null
  headshot_visible: boolean
  image_gen_quota: number
  image_gen_used: number
  image_gen_reset_at: string
  created_at: string
}

export type TokenBalance = {
  budget: number
  used: number
  remaining: number
}

export type ImageGenBalance = {
  quota: number
  used: number
  remaining: number
  reset_at: Date
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
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS cal_username TEXT`
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS studio_is_public BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS headshot_url TEXT`
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS headshot_visible BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS image_gen_quota INT NOT NULL DEFAULT 3`
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS image_gen_used INT NOT NULL DEFAULT 0`
  await sql`ALTER TABLE folios ADD COLUMN IF NOT EXISTS image_gen_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month')`
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
    SELECT id, owner_id, slug, name, email, is_public, studio_is_public, studio_full_access, token_budget, tokens_used, cal_username, headshot_url, headshot_visible, image_gen_quota, image_gen_used, image_gen_reset_at, created_at
    FROM folios WHERE owner_id = ${ownerId} LIMIT 1
  `
  if (existing.length > 0) return existing[0] as Folio

  const slug = await uniqueSlug(nameToSlug(name))
  // Creator's folio (matched by OWNER_EMAIL) starts public; everyone else starts private
  const isCreator = email === (process.env.OWNER_EMAIL ?? '')
  const rows = await sql`
    INSERT INTO folios (owner_id, slug, name, email, is_public)
    VALUES (${ownerId}, ${slug}, ${name}, ${email}, ${isCreator})
    RETURNING id, owner_id, slug, name, email, is_public, studio_is_public, studio_full_access, token_budget, tokens_used, cal_username, headshot_url, headshot_visible, image_gen_quota, image_gen_used, image_gen_reset_at, created_at
  `
  console.log('[folio-ai new-folio]', JSON.stringify({ slug, name, email }))

  // Seed a self-profile connection doc in the new user's own folio
  upsertConnectionOnLogin(name, email, ownerId).catch(() => {})

  return rows[0] as Folio
}

export async function getFolioBySlug(slug: string): Promise<Folio | null> {
  await ensureTable()
  const rows = await sql`
    SELECT id, owner_id, slug, name, email, is_public, studio_is_public, studio_full_access, token_budget, tokens_used, cal_username, headshot_url, headshot_visible, image_gen_quota, image_gen_used, image_gen_reset_at, created_at
    FROM folios WHERE slug = ${slug} LIMIT 1
  `
  return (rows[0] as Folio) ?? null
}

export async function getFolioByOwnerId(ownerId: string): Promise<Folio | null> {
  await ensureTable()
  const rows = await sql`
    SELECT id, owner_id, slug, name, email, is_public, studio_is_public, studio_full_access, token_budget, tokens_used, cal_username, headshot_url, headshot_visible, image_gen_quota, image_gen_used, image_gen_reset_at, created_at
    FROM folios WHERE owner_id = ${ownerId} LIMIT 1
  `
  return (rows[0] as Folio) ?? null
}

export async function getAllFolios(): Promise<Folio[]> {
  await ensureTable()
  const rows = await sql`
    SELECT id, owner_id, slug, name, email, is_public, studio_is_public, studio_full_access, token_budget, tokens_used, cal_username, headshot_url, headshot_visible, image_gen_quota, image_gen_used, image_gen_reset_at, created_at
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

export async function setFolioStudioVisibility(ownerId: string, isPublic: boolean): Promise<void> {
  await sql`UPDATE folios SET studio_is_public = ${isPublic} WHERE owner_id = ${ownerId}`
}

export async function setFolioCalUsername(ownerId: string, calUsername: string | null): Promise<void> {
  await sql`UPDATE folios SET cal_username = ${calUsername} WHERE owner_id = ${ownerId}`
}

export async function consumeTokens(ownerId: string, amount: number): Promise<void> {
  await sql`
    UPDATE folios SET tokens_used = tokens_used + ${amount} WHERE owner_id = ${ownerId}
  `
}

export async function getImageGenBalance(ownerId: string): Promise<ImageGenBalance> {
  await ensureTable()
  const rows = await sql`
    SELECT image_gen_quota, image_gen_used, image_gen_reset_at FROM folios WHERE owner_id = ${ownerId} LIMIT 1
  `
  if (rows.length === 0) return { quota: 3, used: 0, remaining: 3, reset_at: new Date() }
  const { image_gen_quota, image_gen_used, image_gen_reset_at } = rows[0] as {
    image_gen_quota: number
    image_gen_used: number
    image_gen_reset_at: Date
  }
  const resetAt = new Date(image_gen_reset_at)
  const effectiveUsed = new Date() >= resetAt ? 0 : image_gen_used
  return {
    quota: image_gen_quota,
    used: effectiveUsed,
    remaining: Math.max(0, image_gen_quota - effectiveUsed),
    reset_at: resetAt,
  }
}

export async function checkAndConsumeImageGen(ownerId: string): Promise<{ ok: boolean; remaining: number }> {
  // Atomic: resets monthly window if expired, then increments if quota allows
  const rows = await sql`
    UPDATE folios
    SET
      image_gen_used = CASE
        WHEN NOW() >= image_gen_reset_at THEN 1
        ELSE image_gen_used + 1
      END,
      image_gen_reset_at = CASE
        WHEN NOW() >= image_gen_reset_at THEN date_trunc('month', NOW()) + interval '1 month'
        ELSE image_gen_reset_at
      END
    WHERE owner_id = ${ownerId}
      AND (NOW() >= image_gen_reset_at OR image_gen_used < image_gen_quota)
    RETURNING image_gen_used, image_gen_quota
  `
  if (rows.length === 0) return { ok: false, remaining: 0 }
  const { image_gen_used, image_gen_quota } = rows[0] as { image_gen_used: number; image_gen_quota: number }
  return { ok: true, remaining: Math.max(0, image_gen_quota - image_gen_used) }
}

export async function setHeadshotUrl(ownerId: string, url: string | null): Promise<void> {
  await sql`UPDATE folios SET headshot_url = ${url} WHERE owner_id = ${ownerId}`
}

export async function setHeadshotVisible(ownerId: string, visible: boolean): Promise<void> {
  await sql`UPDATE folios SET headshot_visible = ${visible} WHERE owner_id = ${ownerId}`
}

export async function setImageGenQuota(folioId: string, quota: number): Promise<void> {
  await sql`UPDATE folios SET image_gen_quota = ${quota} WHERE id = ${folioId}`
}
