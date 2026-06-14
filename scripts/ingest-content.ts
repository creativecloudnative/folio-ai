import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { neon } from '@neondatabase/serverless'
import { embedBatch, EMBEDDING_MODEL } from '../src/lib/embeddings'

// Use direct connection for writes — pooled connection can drop context mid-script
const sql = neon(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!)
const CONTENT_DIR = join(process.cwd(), 'content')

// Set OWNER_ID in .env.local to your LinkedIn user ID once you have it.
// Until then 'default' scopes all content to a single unnamed owner.
const OWNER_ID = process.env.OWNER_ID ?? 'default'

type DocType = 'bio' | 'resume' | 'case-study' | 'journal'

function chunkText(text: string, maxChars = 600): string[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > maxChars && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

async function upsertDocument(
  type: DocType,
  title: string,
  source: string,
  chunks: string[],
) {
  // Scoped delete — only removes this owner's chunks for the source file
  await sql`DELETE FROM documents WHERE source = ${source} AND owner_id = ${OWNER_ID}`

  const embeddings = await embedBatch(chunks)

  for (let i = 0; i < chunks.length; i++) {
    const vector = `[${embeddings[i].join(',')}]`
    await sql`
      INSERT INTO documents (owner_id, type, title, source, content, embedding)
      VALUES (
        ${OWNER_ID},
        ${type},
        ${title},
        ${source},
        ${chunks[i]},
        ${vector}::vector
      )
    `
  }

  console.log(`✓ ${title} (${source}) — ${chunks.length} chunk(s) embedded with ${EMBEDDING_MODEL}`)
}

async function ingest() {
  console.log('Ingesting content into vector database...\n')

  // bio.md
  const bio = readFileSync(join(CONTENT_DIR, 'bio.md'), 'utf-8').trim()
  if (bio) {
    await upsertDocument('bio', 'Bio', 'bio.md', chunkText(bio))
  }

  // resume.md
  const resume = readFileSync(join(CONTENT_DIR, 'resume.md'), 'utf-8').trim()
  if (resume) {
    await upsertDocument('resume', 'Resume', 'resume.md', chunkText(resume))
  }

  // case-studies/*.md
  const caseStudiesDir = join(CONTENT_DIR, 'case-studies')
  try {
    const files = readdirSync(caseStudiesDir).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      const content = readFileSync(join(caseStudiesDir, file), 'utf-8').trim()
      if (!content) continue
      const title = basename(file, '.md').replace(/-/g, ' ')
      await upsertDocument('case-study', title, `case-studies/${file}`, chunkText(content))
    }
  } catch {
    console.log('  (no case-studies directory or no .md files found — skipping)')
  }

  console.log('\nIngestion complete.')
}

ingest().catch((err) => {
  console.error(err)
  process.exit(1)
})
