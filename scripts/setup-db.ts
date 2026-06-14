import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

// DDL must run on the direct connection — PgBouncer (pooled) drops DDL context
const sql = neon(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!)

async function setup() {
  console.log('Setting up database...')

  await sql`CREATE EXTENSION IF NOT EXISTS vector`
  console.log('✓ pgvector extension enabled')

  // 512 dims — must match EMBEDDING_DIMS in src/lib/embeddings.ts
  // Hardcoded as a SQL literal; pgvector does not accept a parameterized dimension
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id     TEXT NOT NULL DEFAULT 'default',
      submitted_by TEXT,
      type         TEXT NOT NULL,
      title        TEXT NOT NULL,
      source       TEXT,
      content      TEXT NOT NULL,
      embedding    vector(512),
      metadata     JSONB NOT NULL DEFAULT '{}',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  console.log('✓ documents table ready')

  await sql`
    CREATE INDEX IF NOT EXISTS documents_owner_id_idx
    ON documents (owner_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS documents_submitted_by_idx
    ON documents (owner_id, submitted_by)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS documents_embedding_hnsw
    ON documents USING hnsw (embedding vector_cosine_ops)
  `
  console.log('✓ indexes ready')

  console.log('\nDatabase setup complete.')
}

setup().catch((err) => {
  console.error(err)
  process.exit(1)
})
