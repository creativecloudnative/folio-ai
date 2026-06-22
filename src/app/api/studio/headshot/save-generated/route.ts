import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { setHeadshotUrl } from '@/lib/folios'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { url: string }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }
  if (!body.url) return Response.json({ error: 'url required' }, { status: 400 })

  // Re-upload the generated image from Blob so the headshot_url points to the canonical path
  const imageRes = await fetch(body.url)
  if (!imageRes.ok) return Response.json({ error: 'Could not load selected image' }, { status: 502 })
  const buffer = await imageRes.arrayBuffer()

  const { url } = await put(`headshots/${session.user.id}/headshot.png`, buffer, {
    access: 'public',
    contentType: 'image/png',
  })

  await setHeadshotUrl(session.user.id, url)
  return Response.json({ ok: true, url })
}
