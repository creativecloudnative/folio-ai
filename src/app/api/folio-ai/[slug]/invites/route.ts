import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { getFolioInvites, addFolioInvite, removeFolioInvite } from '@/lib/invites'

export const dynamic = 'force-dynamic'

async function ownerFolio(slug: string, userId: string) {
  const folio = await getFolioBySlug(slug)
  return folio?.owner_id === userId ? folio : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const folio = await ownerFolio(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const emails = await getFolioInvites(folio.id)
  return NextResponse.json({ emails })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const folio = await ownerFolio(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { email } = await req.json()
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  await addFolioInvite(folio.id, email)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const folio = await ownerFolio(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }
  await removeFolioInvite(folio.id, email)
  return NextResponse.json({ ok: true })
}
