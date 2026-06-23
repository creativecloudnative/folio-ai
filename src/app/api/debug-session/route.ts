import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdminEmail } from '@/lib/admin'
import { getFolioBySlug } from '@/lib/folios'

// Temporary debug endpoint — requires any valid session, remove after diagnosing ownership mismatch
export async function GET(req: Request) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'not signed in', session: null }, { status: 401 })
  }

  const url = new URL(req.url)
  const slug = url.searchParams.get('slug') ?? 'clint-brown'
  const folio = await getFolioBySlug(slug)

  return NextResponse.json({
    session_user_id:    session.user.id    ?? null,
    session_user_email: session.user.email ?? null,
    session_user_name:  session.user.name  ?? null,
    session_folio_slug: (session.user as { folioSlug?: string }).folioSlug ?? null,
    admin_email_env:    process.env.ADMIN_EMAIL ? 'set' : 'NOT SET',
    is_admin:           isAdminEmail(session.user.email),
    folio_owner_id:     folio?.owner_id ?? null,
    folio_slug:         folio?.slug     ?? null,
    id_match:           folio?.owner_id === session.user.id,
  })
}
