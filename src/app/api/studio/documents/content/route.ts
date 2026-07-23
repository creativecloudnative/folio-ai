import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { ingestDocument } from '@/lib/ingest'
import type { DocType } from '@/lib/ingest'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const source = req.nextUrl.searchParams.get('source')
  if (!source) {
    return Response.json({ error: 'source param required' }, { status: 400 })
  }

  const ownerId = session.user.id
  const rows = await sql`
    SELECT type, title, content FROM documents
    WHERE owner_id = ${ownerId} AND source = ${source}
    ORDER BY created_at ASC
  `
  if (rows.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const type = rows[0].type as string
  const title = rows[0].title as string
  const content = (rows as Array<{ content: string }>).map((r) => r.content).join('\n\n')

  return Response.json({ type, title, content })
}

async function uniqueSource(ownerId: string, folder: string, base: string): Promise<string> {
  let slug = base
  let suffix = 1
  while (true) {
    const source = `content/${folder}/${slug}.md`
    const existing = await sql`
      SELECT 1 FROM documents WHERE owner_id = ${ownerId} AND source = ${source} LIMIT 1
    `
    if (existing.length === 0) return source
    slug = `${base}-${++suffix}`
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  let body: { title?: string; type?: DocType; content?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return Response.json({ error: 'title required' }, { status: 400 })
  }

  const type = body.type ?? 'code-demo'
  const ownerId = session.user.id
  const folder = type === 'case-study' ? 'case-studies' : type
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
  const source = await uniqueSource(ownerId, folder, baseSlug)

  const content = body.content ?? ''
  const { chunks } = await ingestDocument(type, title, source, content, ownerId, ownerId, {})

  return Response.json({ ok: true, source, title, type, content, chunks })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const source = req.nextUrl.searchParams.get('source')
  if (!source) {
    return Response.json({ error: 'source param required' }, { status: 400 })
  }

  let body: { content: string; title: string; type: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const ownerId = session.user.id

  // Verify ownership and fetch existing metadata so we can preserve published state
  const existing = await sql`
    SELECT metadata FROM documents
    WHERE owner_id = ${ownerId} AND source = ${source}
    LIMIT 1
  `
  if (existing.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const existingMeta = (existing[0].metadata as Record<string, unknown>) ?? {}

  const { chunks } = await ingestDocument(
    body.type as DocType,
    body.title,
    source,
    body.content,
    ownerId,
    ownerId,
    existingMeta,
  )

  return Response.json({ ok: true, chunks })
}
