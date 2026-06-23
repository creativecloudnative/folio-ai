import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!)

async function migrate() {
  console.log('Running migration 002: create resumes table...')

  await sql`
    CREATE TABLE IF NOT EXISTS resumes (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id    TEXT        NOT NULL,
      folio_id    UUID        NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL,
      company     TEXT,
      role        TEXT,
      job_url     TEXT,
      job_description TEXT    NOT NULL,
      template    TEXT        NOT NULL DEFAULT 'modern',
      content     TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  console.log('✓ resumes table created')

  await sql`
    CREATE INDEX IF NOT EXISTS resumes_owner_idx ON resumes (owner_id)
  `
  console.log('✓ index on owner_id ready')

  console.log('\nMigration 002 complete.')
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
