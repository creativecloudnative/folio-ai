import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { ingestDocument } from '@/lib/ingest'
import type { DocType } from '@/lib/ingest'

export const dynamic = 'force-dynamic'

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
