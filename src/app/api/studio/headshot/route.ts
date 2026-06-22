import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getFolioByOwnerId, setHeadshotVisible, getImageGenBalance } from '@/lib/folios'

export const dynamic = 'force-dynamic'

// GET — return current headshot state + image gen balance
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const folio = await getFolioByOwnerId(session.user.id)
  if (!folio) return Response.json({ error: 'not_found' }, { status: 404 })

  const imageGenBalance = await getImageGenBalance(session.user.id)

  return Response.json({
    headshot_url: folio.headshot_url,
    headshot_visible: folio.headshot_visible,
    imageGenBalance,
  })
}

// PATCH — toggle headshot_visible
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { headshot_visible?: boolean }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  if (typeof body.headshot_visible !== 'boolean') {
    return Response.json({ error: 'headshot_visible must be a boolean' }, { status: 400 })
  }

  await setHeadshotVisible(session.user.id, body.headshot_visible)
  return Response.json({ ok: true })
}
