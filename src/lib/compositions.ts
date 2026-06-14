import { sql } from './db'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompositionType = {
  id: string
  owner_id: string
  name: string
  slug: string
  built_in: boolean
  folio_visible: boolean
  position: number
}

export type Composition = {
  id: string
  owner_id: string
  type: string
  title: string
  slug: string
  published: boolean
  created_at: string
  updated_at: string
}

export type CompositionItem = {
  id: string
  composition_id: string
  document_source: string | null
  ref_composition_id: string | null
  ref_composition_title: string | null
  document_title: string | null
  section_label: string
  position: number
}

// ── Schema ────────────────────────────────────────────────────────────────────

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS composition_types (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id      TEXT         NOT NULL,
      name          TEXT         NOT NULL,
      slug          TEXT         NOT NULL,
      built_in      BOOLEAN      NOT NULL DEFAULT FALSE,
      folio_visible BOOLEAN      NOT NULL DEFAULT TRUE,
      position      INTEGER      NOT NULL DEFAULT 0,
      UNIQUE(owner_id, slug)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS compositions (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id    TEXT         NOT NULL,
      type        TEXT         NOT NULL,
      title       TEXT         NOT NULL,
      slug        TEXT         NOT NULL,
      published   BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      UNIQUE(owner_id, slug)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS composition_items (
      id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      composition_id       UUID         NOT NULL REFERENCES compositions(id) ON DELETE CASCADE,
      document_source      TEXT,
      ref_composition_id   UUID,
      section_label        TEXT         NOT NULL DEFAULT '',
      position             INTEGER      NOT NULL DEFAULT 0
    )
  `
}

// ── Composition Types ─────────────────────────────────────────────────────────

const BUILT_IN_TYPES = [
  { name: 'Architecture', slug: 'architecture', folio_visible: true, position: 0 },
  { name: 'Case Studies', slug: 'case-study',   folio_visible: true, position: 1 },
  { name: 'Folio Page',   slug: 'folio',         folio_visible: false, position: 99 },
]

export async function ensureBuiltInTypes(ownerId: string) {
  await ensureTables()
  for (const t of BUILT_IN_TYPES) {
    await sql`
      INSERT INTO composition_types (owner_id, name, slug, built_in, folio_visible, position)
      VALUES (${ownerId}, ${t.name}, ${t.slug}, TRUE, ${t.folio_visible}, ${t.position})
      ON CONFLICT (owner_id, slug) DO NOTHING
    `
  }
}

export async function getCompositionTypes(ownerId: string): Promise<CompositionType[]> {
  await ensureBuiltInTypes(ownerId)
  const rows = await sql`
    SELECT id, owner_id, name, slug, built_in, folio_visible, position
    FROM composition_types
    WHERE owner_id = ${ownerId}
    ORDER BY position ASC, name ASC
  `
  return rows as CompositionType[]
}

export async function createCompositionType(
  ownerId: string,
  name: string,
  slug: string,
): Promise<CompositionType> {
  await ensureTables()
  const maxPos = await sql`
    SELECT COALESCE(MAX(position), 1) + 1 AS next FROM composition_types WHERE owner_id = ${ownerId}
  `
  const position = (maxPos[0].next as number) ?? 2
  const rows = await sql`
    INSERT INTO composition_types (owner_id, name, slug, built_in, folio_visible, position)
    VALUES (${ownerId}, ${name}, ${slug}, FALSE, TRUE, ${position})
    RETURNING id, owner_id, name, slug, built_in, folio_visible, position
  `
  return rows[0] as CompositionType
}

export async function updateCompositionType(
  id: string,
  ownerId: string,
  fields: { name?: string; folio_visible?: boolean; position?: number },
): Promise<void> {
  const patch = JSON.stringify({
    ...(fields.name !== undefined && { name: fields.name }),
    ...(fields.folio_visible !== undefined && { folio_visible: fields.folio_visible }),
    ...(fields.position !== undefined && { position: fields.position }),
  })
  await sql`
    UPDATE composition_types
    SET
      name          = CASE WHEN ${patch}::jsonb ? 'name'          THEN (${patch}::jsonb->>'name')::text        ELSE name          END,
      folio_visible = CASE WHEN ${patch}::jsonb ? 'folio_visible' THEN (${patch}::jsonb->>'folio_visible')::boolean ELSE folio_visible END,
      position      = CASE WHEN ${patch}::jsonb ? 'position'      THEN (${patch}::jsonb->>'position')::int      ELSE position      END
    WHERE id = ${id} AND owner_id = ${ownerId} AND built_in = FALSE
  `
}

export async function deleteCompositionType(id: string, ownerId: string): Promise<void> {
  await sql`
    DELETE FROM composition_types WHERE id = ${id} AND owner_id = ${ownerId} AND built_in = FALSE
  `
}

// ── Compositions ──────────────────────────────────────────────────────────────

export async function getCompositions(ownerId: string): Promise<Composition[]> {
  await ensureTables()
  const rows = await sql`
    SELECT id, owner_id, type, title, slug, published, created_at, updated_at
    FROM compositions
    WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC
  `
  return rows as Composition[]
}

export async function getComposition(id: string, ownerId: string): Promise<Composition | null> {
  const rows = await sql`
    SELECT id, owner_id, type, title, slug, published, created_at, updated_at
    FROM compositions WHERE id = ${id} AND owner_id = ${ownerId} LIMIT 1
  `
  return (rows[0] as Composition) ?? null
}

export async function getCompositionBySlug(slug: string, ownerId: string): Promise<Composition | null> {
  const rows = await sql`
    SELECT id, owner_id, type, title, slug, published, created_at, updated_at
    FROM compositions WHERE slug = ${slug} AND owner_id = ${ownerId} LIMIT 1
  `
  return (rows[0] as Composition) ?? null
}

export async function createComposition(
  ownerId: string,
  type: string,
  title: string,
  slug: string,
): Promise<Composition> {
  await ensureTables()
  const rows = await sql`
    INSERT INTO compositions (owner_id, type, title, slug)
    VALUES (${ownerId}, ${type}, ${title}, ${slug})
    RETURNING id, owner_id, type, title, slug, published, created_at, updated_at
  `
  return rows[0] as Composition
}

export async function updateComposition(
  id: string,
  ownerId: string,
  fields: { title?: string; slug?: string },
): Promise<boolean> {
  const rows = await sql`
    UPDATE compositions
    SET
      title      = COALESCE(${fields.title ?? null}, title),
      slug       = COALESCE(${fields.slug  ?? null}, slug),
      updated_at = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING id
  `
  return rows.length > 0
}

export async function deleteComposition(id: string, ownerId: string): Promise<void> {
  await sql`DELETE FROM compositions WHERE id = ${id} AND owner_id = ${ownerId}`
}

export async function getPublishedCompositionsForFolio(
  ownerId: string,
): Promise<Array<Composition & { type_name: string; type_position: number }>> {
  await ensureBuiltInTypes(ownerId)
  const rows = await sql`
    SELECT c.id, c.owner_id, c.type, c.title, c.slug, c.published, c.created_at, c.updated_at,
           COALESCE(ct.name, c.type)  AS type_name,
           COALESCE(ct.position, 99)  AS type_position
    FROM compositions c
    LEFT JOIN composition_types ct ON ct.slug = c.type AND ct.owner_id = c.owner_id
    WHERE c.owner_id = ${ownerId}
      AND c.published = TRUE
      AND COALESCE(ct.folio_visible, TRUE)
      AND c.type != 'folio'
    ORDER BY COALESCE(ct.position, 99) ASC, c.updated_at DESC
  `
  return rows as Array<Composition & { type_name: string; type_position: number }>
}

export async function getFolioComposition(ownerId: string): Promise<Composition | null> {
  const rows = await sql`
    SELECT id, owner_id, type, title, slug, published, created_at, updated_at
    FROM compositions WHERE owner_id = ${ownerId} AND type = 'folio' LIMIT 1
  `
  return (rows[0] as Composition) ?? null
}

// ── Composition Items ─────────────────────────────────────────────────────────

export async function getCompositionItems(compositionId: string): Promise<CompositionItem[]> {
  const rows = await sql`
    SELECT
      ci.id, ci.composition_id, ci.document_source, ci.ref_composition_id,
      ci.section_label, ci.position,
      CASE WHEN ci.document_source IS NOT NULL
        THEN (SELECT title FROM documents WHERE source = ci.document_source LIMIT 1)
        ELSE NULL
      END AS document_title,
      CASE WHEN ci.ref_composition_id IS NOT NULL
        THEN (SELECT title FROM compositions WHERE id = ci.ref_composition_id LIMIT 1)
        ELSE NULL
      END AS ref_composition_title
    FROM composition_items ci
    WHERE ci.composition_id = ${compositionId}
    ORDER BY ci.position ASC, ci.id ASC
  `
  return rows as CompositionItem[]
}

export async function setCompositionItems(
  compositionId: string,
  items: Array<{
    document_source?: string | null
    ref_composition_id?: string | null
    section_label: string
    position: number
  }>,
): Promise<void> {
  await sql`DELETE FROM composition_items WHERE composition_id = ${compositionId}`
  for (const item of items) {
    await sql`
      INSERT INTO composition_items (composition_id, document_source, ref_composition_id, section_label, position)
      VALUES (
        ${compositionId},
        ${item.document_source ?? null},
        ${item.ref_composition_id ?? null},
        ${item.section_label},
        ${item.position}
      )
    `
  }
}

// ── Auto-seed from existing documents ────────────────────────────────────────

export async function seedCompositionsFromDocuments(ownerId: string): Promise<void> {
  await ensureBuiltInTypes(ownerId)

  // Always ensure the folio composition exists (the one that controls the public page layout)
  const folioInsert = await sql`
    INSERT INTO compositions (owner_id, type, title, slug, published)
    VALUES (${ownerId}, 'folio', 'Folio Page', 'folio-page', FALSE)
    ON CONFLICT (owner_id, slug) DO NOTHING
    RETURNING id
  `

  const docs = await sql`
    SELECT DISTINCT ON (source) source, title, type
    FROM documents
    WHERE owner_id = ${ownerId} AND type IN ('case-study', 'architecture')
    ORDER BY source, created_at DESC
  `

  for (const doc of docs) {
    const source = doc.source as string
    const type   = doc.type  as string
    const title  = doc.title as string

    const slug = source
      .replace(/^content\/case-studies\//, '')
      .replace(/^content\/architecture\//, '')
      .replace(/\.md$/, '')

    if (!slug) continue

    const existing = await sql`
      SELECT id FROM compositions WHERE owner_id = ${ownerId} AND slug = ${slug} LIMIT 1
    `
    if (existing.length > 0) continue

    const isPublished = await sql`
      SELECT 1 FROM documents
      WHERE owner_id = ${ownerId} AND source = ${source} AND metadata->>'published' = 'true'
      LIMIT 1
    `

    const created = await sql`
      INSERT INTO compositions (owner_id, type, title, slug, published)
      VALUES (${ownerId}, ${type}, ${title}, ${slug}, ${isPublished.length > 0})
      ON CONFLICT (owner_id, slug) DO NOTHING
      RETURNING id
    `
    if (created.length === 0) continue

    const compositionId = created[0].id as string
    const defaultLabel  = type === 'case-study' ? 'Case Study' : 'Architecture'

    await sql`
      INSERT INTO composition_items (composition_id, document_source, section_label, position)
      VALUES (${compositionId}, ${source}, ${defaultLabel}, 0)
    `
  }

  // Populate folio composition items if empty (covers both first creation and existing empty rows)
  const folioRow = folioInsert.length > 0
    ? folioInsert[0]
    : (await sql`SELECT id FROM compositions WHERE owner_id = ${ownerId} AND type = 'folio' LIMIT 1`)[0]

  if (folioRow) {
    const folioId = folioRow.id as string
    const existingItems = await sql`
      SELECT id FROM composition_items WHERE composition_id = ${folioId} LIMIT 1
    `
    if (existingItems.length === 0) {

    let pos = 0

    const bio = await sql`
      SELECT source FROM documents
      WHERE owner_id = ${ownerId} AND type = 'bio'
      ORDER BY created_at DESC LIMIT 1
    `
    if (bio.length > 0) {
      await sql`
        INSERT INTO composition_items (composition_id, document_source, section_label, position)
        VALUES (${folioId}, ${bio[0].source as string}, 'Intro', ${pos++})
      `
    }

    // Add existing non-folio compositions as refs, sorted by type position then title
    const comps = await sql`
      SELECT c.id, c.title, ct.position AS type_position
      FROM compositions c
      JOIN composition_types ct ON ct.slug = c.type AND ct.owner_id = c.owner_id
      WHERE c.owner_id = ${ownerId} AND c.type != 'folio'
      ORDER BY ct.position ASC, c.title ASC
    `
    for (const comp of comps) {
      await sql`
        INSERT INTO composition_items (composition_id, ref_composition_id, section_label, position)
        VALUES (${folioId}, ${comp.id as string}, ${comp.title as string}, ${pos++})
      `
    }
    } // end existingItems.length === 0
  }
}

// ── Unique slug helper ────────────────────────────────────────────────────────

export async function uniqueCompositionSlug(ownerId: string, base: string): Promise<string> {
  let slug   = base
  let suffix = 1
  while (true) {
    const existing = await sql`
      SELECT id FROM compositions WHERE owner_id = ${ownerId} AND slug = ${slug} LIMIT 1
    `
    if (existing.length === 0) break
    slug = `${base}-${suffix++}`
  }
  return slug
}
