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
    SELECT
      type, title, source, submitted_by,
      COUNT(*)::int                                    AS chunk_count,
      bool_or((metadata->>'is_baseline')::boolean)     AS is_baseline,
      bool_or((metadata->>'published') = 'true')       AS is_published,
      MIN(created_at)                                  AS created_at
    FROM documents
    WHERE owner_id = ${folio.owner_id}
    GROUP BY type, title, source, submitted_by
    ORDER BY type, MIN(created_at) DESC
  `
  return NextResponse.json({ documents: rows })
}
