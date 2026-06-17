import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { resolveStudioOwner } from '@/lib/studio-access'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  const folio = await resolveStudioOwner(slug, session)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await sql`
    SELECT id, title, created_at, updated_at
    FROM conversations
    WHERE owner_id = ${folio.owner_id}
    ORDER BY updated_at DESC
  `
  return NextResponse.json({ conversations: rows })
}
