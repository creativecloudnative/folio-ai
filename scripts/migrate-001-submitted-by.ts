import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!)

async function migrate() {
  console.log('Running migration 001: add submitted_by column...')

  // Add submitted_by — nullable so existing rows are unaffected
  await sql`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS submitted_by TEXT
  `
  console.log('✓ submitted_by column added')

  // Back-fill existing rows: owner created their own content
  await sql`
    UPDATE documents
    SET submitted_by = owner_id
    WHERE submitted_by IS NULL
  `
  console.log('✓ existing rows back-filled (submitted_by = owner_id)')

  // Index for querying "all docs submitted by a specific visitor to a folio"
  await sql`
    CREATE INDEX IF NOT EXISTS documents_submitted_by_idx
    ON documents (owner_id, submitted_by)
  `
  console.log('✓ index on (owner_id, submitted_by) ready')

  console.log('\nMigration 001 complete.')
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
