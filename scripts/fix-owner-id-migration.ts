/**
 * fix-owner-id-migration.ts
 *
 * Cascades the folio owner_id change to all associated tables.
 *
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/fix-owner-id-migration.ts
 */

import { sql } from '../src/lib/db'

const FOLIO_EMAIL = 'clint.brown.atx@gmail.com'

async function run() {
  const folioRows = await sql`SELECT owner_id FROM folios WHERE email = ${FOLIO_EMAIL} LIMIT 1`
  if (folioRows.length === 0) { console.error('No folio found for', FOLIO_EMAIL); process.exit(1) }
  const newId = folioRows[0].owner_id as string
  console.log(`Current folio owner_id: ${newId}\n`)

  const orphaned = <T extends { owner_id: string }>(rows: T[]) =>
    rows.map(r => r.owner_id as string)

  // ── documents ──────────────────────────────────────────────────────────────
  const oldDocIds = orphaned(await sql`
    SELECT DISTINCT owner_id FROM documents
    WHERE owner_id != ${newId} AND owner_id NOT IN (SELECT owner_id FROM folios)
  ` as { owner_id: string }[])

  for (const old of oldDocIds) {
    const r = await sql`UPDATE documents SET owner_id = ${newId} WHERE owner_id = ${old} RETURNING id`
    console.log(`documents: migrated ${r.length} rows from ${old}`)
  }
  if (oldDocIds.length === 0) console.log('documents: ok')

  // ── composition_types: built-ins already seeded under new UUID — delete old ─
  const oldCtIds = orphaned(await sql`
    SELECT DISTINCT owner_id FROM composition_types
    WHERE owner_id != ${newId} AND owner_id NOT IN (SELECT owner_id FROM folios)
  ` as { owner_id: string }[])

  for (const old of oldCtIds) {
    const r = await sql`DELETE FROM composition_types WHERE owner_id = ${old} RETURNING slug`
    console.log(`composition_types: deleted ${r.length} rows from ${old}`)
  }
  if (oldCtIds.length === 0) console.log('composition_types: ok')

  // ── compositions: delete any stub under new UUID that conflicts, then migrate ─
  const oldCompIds = orphaned(await sql`
    SELECT DISTINCT owner_id FROM compositions
    WHERE owner_id != ${newId} AND owner_id NOT IN (SELECT owner_id FROM folios)
  ` as { owner_id: string }[])

  for (const old of oldCompIds) {
    // Slugs that already exist under new UUID (stubs created after migration)
    const conflicts = await sql`
      SELECT c_old.slug
      FROM compositions c_old
      JOIN compositions c_new ON c_new.owner_id = ${newId} AND c_new.slug = c_old.slug
      WHERE c_old.owner_id = ${old}
    `
    if (conflicts.length > 0) {
      const slugs = (conflicts as { slug: string }[]).map(r => r.slug)
      // Delete the stubs under new UUID so we can migrate the real ones
      for (const slug of slugs) {
        await sql`DELETE FROM compositions WHERE owner_id = ${newId} AND slug = ${slug}`
        console.log(`compositions: deleted stub ${slug} under new UUID`)
      }
    }
    const r = await sql`UPDATE compositions SET owner_id = ${newId} WHERE owner_id = ${old} RETURNING title, slug`
    console.log(`compositions: migrated ${r.length} rows from ${old}`)
    for (const row of r as { title: string; slug: string }[]) console.log(`  - "${row.title}" (${row.slug})`)
  }
  if (oldCompIds.length === 0) console.log('compositions: ok')

  // ── job_applications ───────────────────────────────────────────────────────
  const oldAppIds = orphaned(await sql`
    SELECT DISTINCT owner_id FROM job_applications
    WHERE owner_id != ${newId} AND owner_id NOT IN (SELECT owner_id FROM folios)
  ` as { owner_id: string }[])

  for (const old of oldAppIds) {
    const r = await sql`UPDATE job_applications SET owner_id = ${newId} WHERE owner_id = ${old} RETURNING id`
    console.log(`job_applications: migrated ${r.length} rows from ${old}`)
  }
  if (oldAppIds.length === 0) console.log('job_applications: ok')

  // ── resumes ────────────────────────────────────────────────────────────────
  const oldResIds = orphaned(await sql`
    SELECT DISTINCT owner_id FROM resumes
    WHERE owner_id != ${newId} AND owner_id NOT IN (SELECT owner_id FROM folios)
  ` as { owner_id: string }[])

  for (const old of oldResIds) {
    const r = await sql`UPDATE resumes SET owner_id = ${newId} WHERE owner_id = ${old} RETURNING id`
    console.log(`resumes: migrated ${r.length} rows from ${old}`)
  }
  if (oldResIds.length === 0) console.log('resumes: ok')

  // ── conversations ──────────────────────────────────────────────────────────
  const oldConvIds = orphaned(await sql`
    SELECT DISTINCT owner_id FROM conversations
    WHERE owner_id != ${newId} AND owner_id NOT IN (SELECT owner_id FROM folios)
  ` as { owner_id: string }[])

  for (const old of oldConvIds) {
    const r = await sql`UPDATE conversations SET owner_id = ${newId} WHERE owner_id = ${old} RETURNING id`
    console.log(`conversations: migrated ${r.length} rows from ${old}`)
  }
  if (oldConvIds.length === 0) console.log('conversations: ok')

  // ── Verify ─────────────────────────────────────────────────────────────────
  console.log('\nVerification:')
  const docs  = await sql`SELECT COUNT(*)::int AS n FROM documents       WHERE owner_id = ${newId}`
  const comps = await sql`SELECT COUNT(*)::int AS n FROM compositions     WHERE owner_id = ${newId}`
  const apps  = await sql`SELECT COUNT(*)::int AS n FROM job_applications WHERE owner_id = ${newId}`
  const res   = await sql`SELECT COUNT(*)::int AS n FROM resumes          WHERE owner_id = ${newId}`
  const convs = await sql`SELECT COUNT(*)::int AS n FROM conversations    WHERE owner_id = ${newId}`
  console.log(`  documents:        ${docs[0].n}`)
  console.log(`  compositions:     ${comps[0].n}`)
  console.log(`  job_applications: ${apps[0].n}`)
  console.log(`  resumes:          ${res[0].n}`)
  console.log(`  conversations:    ${convs[0].n}`)

  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
