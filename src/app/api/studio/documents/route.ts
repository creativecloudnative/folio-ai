import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const ownerId = session.user.id

  const rows = await sql`
    SELECT
      type,
      title,
      source,
      submitted_by,
      COUNT(*)::int                                      AS chunk_count,
      bool_or((metadata->>'is_baseline')::boolean)       AS is_baseline,
      bool_or((metadata->>'published') = 'true')         AS is_published,
      MIN(created_at)                                    AS created_at
    FROM documents
    WHERE owner_id = ${ownerId}
    GROUP BY type, title, source, submitted_by
    ORDER BY type, MIN(created_at) DESC
  `

  return Response.json({ documents: rows })
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

  const body = await req.json().catch(() => ({}))
  if (typeof body.published !== 'boolean') {
    return Response.json({ error: 'published (boolean) required in body' }, { status: 400 })
  }

  const ownerId = session.user.id!
  const patch = JSON.stringify({ published: body.published })
  const result = await sql`
    UPDATE documents
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${patch}::jsonb
    WHERE owner_id = ${ownerId} AND source = ${source}
    RETURNING id
  `

  // Targeted revalidation for publishable content types
  const caseStudyMatch = source.match(/content\/case-studies\/(.+)\.md$/)
  const architectureMatch = source.match(/content\/architecture\/(.+)\.md$/)
  if (caseStudyMatch) revalidatePath(`/case-studies/${caseStudyMatch[1]}`)
  if (architectureMatch) revalidatePath(`/architecture/${architectureMatch[1]}`)
  revalidatePath('/')

  return Response.json({ updated: result.length, published: body.published })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const source = req.nextUrl.searchParams.get('source')
  if (!source) {
    return Response.json({ error: 'source param required' }, { status: 400 })
  }

  const ownerId = session.user.id!
  const result = await sql`
    DELETE FROM documents
    WHERE owner_id = ${ownerId} AND source = ${source}
    RETURNING id
  `

  return Response.json({ deleted: result.length })
}
