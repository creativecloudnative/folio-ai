import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { updateCompositionType, deleteCompositionType } from '@/lib/compositions'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  let body: { name?: string; folio_visible?: boolean; position?: number }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }
  await updateCompositionType(id, session.user.id, body)
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })
  const { id } = await params
  await deleteCompositionType(id, session.user.id)
  return Response.json({ ok: true })
}
