import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const { id } = await params
  const ownerId = session.user.id

  const rows = await sql`
    SELECT id, title, messages, created_at, updated_at
    FROM conversations
    WHERE id = ${id} AND owner_id = ${ownerId}
    LIMIT 1
  `

  if (rows.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  return Response.json({ conversation: rows[0] })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const { id } = await params
  const ownerId = session.user.id

  let body: { title: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return Response.json({ error: 'title required' }, { status: 400 })
  }

  const rows = await sql`
    UPDATE conversations
    SET title = ${body.title.trim()}, updated_at = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING id
  `

  if (rows.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  return Response.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const { id } = await params
  const ownerId = session.user.id

  await sql`
    DELETE FROM conversations
    WHERE id = ${id} AND owner_id = ${ownerId}
  `

  return Response.json({ ok: true })
}
