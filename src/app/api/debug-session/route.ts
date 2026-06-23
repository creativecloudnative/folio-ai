import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdminEmail } from '@/lib/admin'
import { getFolioBySlug } from '@/lib/folios'

// Temporary debug endpoint — admin-only, remove after diagnosing ownership mismatch
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const slug = url.searchParams.get('slug') ?? 'clint-brown'
  const folio = await getFolioBySlug(slug)

  return NextResponse.json({
    session_user_id:   session.user.id ?? null,
    session_user_email: session.user.email ?? null,
    session_user_name: session.user.name ?? null,
    session_folio_slug: session.user.folioSlug ?? null,
    folio_owner_id:    folio?.owner_id ?? null,
    folio_slug:        folio?.slug ?? null,
    id_match:          folio?.owner_id === session.user.id,
  })
}
