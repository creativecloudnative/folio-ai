import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFolioBySlug, setFolioVisibility } from '@/lib/folios'

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
  const isPublic = Boolean(body.is_public)
  await setFolioVisibility(folio.owner_id, isPublic)

  return NextResponse.json({ is_public: isPublic })
}
