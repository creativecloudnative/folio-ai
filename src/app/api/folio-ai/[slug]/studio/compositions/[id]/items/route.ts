import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { resolveStudioOwner } from '@/lib/studio-access'
import { getComposition, getCompositionItems } from '@/lib/compositions'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const [session, { slug, id }] = await Promise.all([auth(), params])
  const folio = await resolveStudioOwner(slug, session)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const composition = await getComposition(id, folio.owner_id)
  if (!composition) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const items = await getCompositionItems(id)
  return NextResponse.json({ items })
}
