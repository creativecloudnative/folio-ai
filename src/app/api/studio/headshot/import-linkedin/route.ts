import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { setHeadshotUrl } from '@/lib/folios'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const linkedInPicUrl = session.user.image
  if (!linkedInPicUrl) {
    return Response.json({ error: 'No LinkedIn profile picture found on your account' }, { status: 404 })
  }

  // Fetch the LinkedIn CDN image and re-upload to Blob so we own the asset
  let imageRes: Response
  try {
    imageRes = await fetch(linkedInPicUrl)
    if (!imageRes.ok) throw new Error(`LinkedIn CDN returned ${imageRes.status}`)
  } catch {
    return Response.json({ error: 'Could not fetch your LinkedIn profile picture' }, { status: 502 })
  }

  const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg'
  const buffer = await imageRes.arrayBuffer()

  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const { url } = await put(`headshots/${session.user.id}/headshot.${ext}`, buffer, {
    access: 'public',
    contentType,
  })

  await setHeadshotUrl(session.user.id, url)
  return Response.json({ ok: true, url })
}
