import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { del } from '@vercel/blob'
import { getFolioByOwnerId, setHeadshotUrl } from '@/lib/folios'
import { listHeadshotHistory } from '@/lib/headshot-storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const folio = await getFolioByOwnerId(session.user.id)
  const history = await listHeadshotHistory(session.user.id, folio?.headshot_url ?? null)
  return Response.json({ history })
}

// PATCH — restore a history entry as the active headshot
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { url: string }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  if (!body.url?.includes(`headshots/${session.user.id}/`)) {
    return Response.json({ error: 'invalid url' }, { status: 400 })
  }

  await setHeadshotUrl(session.user.id, body.url)
  return Response.json({ ok: true })
}

// DELETE — remove a non-active history entry
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { url: string }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  if (!body.url?.includes(`headshots/${session.user.id}/`)) {
    return Response.json({ error: 'invalid url' }, { status: 400 })
  }

  const folio = await getFolioByOwnerId(session.user.id)
  if (folio?.headshot_url === body.url) {
    return Response.json({ error: 'Cannot delete the active headshot' }, { status: 400 })
  }

  try {
    await del(body.url)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[headshot history DELETE]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
