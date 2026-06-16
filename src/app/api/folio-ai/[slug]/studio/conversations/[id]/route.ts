import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { resolveStudioOwner } from '@/lib/studio-access'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const [session, { slug, id }] = await Promise.all([auth(), params])
  const folio = await resolveStudioOwner(slug, session)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await sql`
    SELECT id, title, messages, created_at, updated_at
    FROM conversations
    WHERE id = ${id} AND owner_id = ${folio.owner_id}
    LIMIT 1
  `
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ conversation: rows[0] })
}
