import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getComposition, getCompositionItems, setCompositionItems } from '@/lib/compositions'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  const composition = await getComposition(id, session.user.id)
  if (!composition) return Response.json({ error: 'not_found' }, { status: 404 })
  const items = await getCompositionItems(id)
  return Response.json({ items })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  const composition = await getComposition(id, session.user.id)
  if (!composition) return Response.json({ error: 'not_found' }, { status: 404 })

  let body: { items: Array<{ document_source?: string | null; ref_composition_id?: string | null; section_label: string; position: number }> }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  await setCompositionItems(id, body.items)
  return Response.json({ ok: true })
}
