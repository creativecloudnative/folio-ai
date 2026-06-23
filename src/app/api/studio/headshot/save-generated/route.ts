import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { setHeadshotUrl, getFolioByOwnerId } from '@/lib/folios'
import { headshotKey, pruneHeadshotHistory } from '@/lib/headshot-storage'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { dataUrl: string }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }
  if (!body.dataUrl?.startsWith('data:image/')) {
    return Response.json({ error: 'dataUrl required' }, { status: 400 })
  }

  try {
    const base64 = body.dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')

    const { url } = await put(headshotKey(session.user.id, 'png'), buffer, {
      access: 'public',
      contentType: 'image/png',
    })

    const folio = await getFolioByOwnerId(session.user.id)
    await setHeadshotUrl(session.user.id, url)
    pruneHeadshotHistory(session.user.id, folio?.headshot_url ?? null).catch(() => {})
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[headshot save-generated]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
