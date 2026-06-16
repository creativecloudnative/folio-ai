import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFolioBySlug, setFolioStudioVisibility } from '@/lib/folios'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folio = await getFolioBySlug(slug)
  if (!folio) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (folio.owner_id !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { is_public } = await req.json()
  await setFolioStudioVisibility(folio.owner_id, Boolean(is_public))
  return NextResponse.json({ studio_is_public: Boolean(is_public) })
}
