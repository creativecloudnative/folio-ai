import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getCompositions, createComposition, seedCompositionsFromDocuments, uniqueCompositionSlug } from '@/lib/compositions'
import { nameToSlug } from '@/lib/folios'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  await seedCompositionsFromDocuments(session.user.id)
  const compositions = await getCompositions(session.user.id)
  return Response.json({ compositions })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { title: string; type: string }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  if (!body.title?.trim()) return Response.json({ error: 'title required' }, { status: 400 })
  if (!body.type?.trim())  return Response.json({ error: 'type required' },  { status: 400 })

  const ownerId = session.user.id
  const slug    = await uniqueCompositionSlug(ownerId, nameToSlug(body.title.trim()))

  const composition = await createComposition(ownerId, body.type, body.title.trim(), slug)
  return Response.json({ composition }, { status: 201 })
}
