import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { getStudioInvites, addStudioInvite, removeStudioInvite } from '@/lib/studio-invites'

export const dynamic = 'force-dynamic'

async function ownerOnly(slug: string, userId: string) {
  const folio = await getFolioBySlug(slug)
  if (!folio || folio.owner_id !== userId) return null
  return folio
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const folio = await ownerOnly(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const emails = await getStudioInvites(folio.id)
  return NextResponse.json({ emails })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const folio = await ownerOnly(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { email } = await req.json() as { email: string }
  if (!email?.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 422 })
  await addStudioInvite(folio.id, email.trim().toLowerCase())
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const folio = await ownerOnly(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { email } = await req.json() as { email: string }
  await removeStudioInvite(folio.id, email)
  return NextResponse.json({ ok: true })
}
