import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getCompositionTypes, createCompositionType } from '@/lib/compositions'
import { nameToSlug } from '@/lib/folios'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const types = await getCompositionTypes(session.user.id)
  return Response.json({ types })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { name: string }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }
  if (!body.name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const ownerId = session.user.id
  const slug    = nameToSlug(body.name.trim())

  const existing = await sql`
    SELECT id FROM composition_types WHERE owner_id = ${ownerId} AND slug = ${slug} LIMIT 1
  `
  if (existing.length > 0) return Response.json({ error: 'A type with that name already exists' }, { status: 409 })

  const type = await createCompositionType(ownerId, body.name.trim(), slug)
  return Response.json({ type }, { status: 201 })
}
