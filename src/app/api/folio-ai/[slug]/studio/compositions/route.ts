import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { resolveStudioOwner } from '@/lib/studio-access'
import { getCompositions } from '@/lib/compositions'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  const folio = await resolveStudioOwner(slug, session)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const compositions = await getCompositions(folio.owner_id)
  return NextResponse.json({ compositions })
}
