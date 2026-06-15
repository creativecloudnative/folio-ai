import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdminEmail } from '@/lib/admin'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const ownerId = searchParams.get('owner_id')
  const source = searchParams.get('source')

  if (!ownerId || !source) {
    return NextResponse.json({ error: 'owner_id and source are required' }, { status: 400 })
  }

  const rows = await sql`
    SELECT id, type, title, source, content, created_at
    FROM documents
    WHERE owner_id = ${ownerId} AND source = ${source}
    ORDER BY created_at, id
  `

  return NextResponse.json({ chunks: rows })
}
