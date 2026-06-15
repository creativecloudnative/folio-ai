import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFolioBySlug, setFolioCalUsername } from '@/lib/folios'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const folio = await getFolioBySlug(slug)
  if (!folio) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (folio.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  if ('cal_username' in body) {
    const raw = typeof body.cal_username === 'string' ? body.cal_username.trim() : null
    const calUsername = raw || null
    await setFolioCalUsername(folio.owner_id, calUsername)
    return NextResponse.json({ cal_username: calUsername })
  }

  return NextResponse.json({ error: 'No recognized field to update' }, { status: 400 })
}
