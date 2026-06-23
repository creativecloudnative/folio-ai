import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!)

async function migrate() {
  console.log('Running migration 003: create job_applications and application_events tables...')

  await sql`
    CREATE TABLE IF NOT EXISTS job_applications (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id    TEXT        NOT NULL,
      company     TEXT        NOT NULL,
      role        TEXT        NOT NULL,
      job_url     TEXT,
      resume_id   UUID        REFERENCES resumes(id) ON DELETE SET NULL,
      status      TEXT        NOT NULL DEFAULT 'applied',
      applied_at  DATE,
      notes       TEXT        NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  console.log('✓ job_applications table created')

  await sql`
    CREATE INDEX IF NOT EXISTS job_applications_owner_idx ON job_applications (owner_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS job_applications_status_idx ON job_applications (owner_id, status)
  `
  console.log('✓ job_applications indexes ready')

  await sql`
    CREATE TABLE IF NOT EXISTS application_events (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id  UUID        NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
      owner_id        TEXT        NOT NULL,
      event_type      TEXT        NOT NULL DEFAULT 'note',
      title           TEXT,
      notes           TEXT        NOT NULL DEFAULT '',
      occurred_at     DATE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  console.log('✓ application_events table created')

  await sql`
    CREATE INDEX IF NOT EXISTS application_events_app_idx ON application_events (application_id)
  `
  console.log('✓ application_events index ready')

  console.log('\nMigration 003 complete.')
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
