import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { setHeadshotUrl } from '@/lib/folios'
import { moderateImage } from '@/lib/image-moderation'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const linkedInPicUrl = session.user.image
  if (!linkedInPicUrl) {
    return Response.json({ error: 'No LinkedIn profile picture found on your account' }, { status: 404 })
  }

  try {
    const imageRes = await fetch(linkedInPicUrl)
    if (!imageRes.ok) {
      return Response.json({ error: `Could not fetch your LinkedIn profile picture (${imageRes.status})` }, { status: 502 })
    }

    const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await imageRes.arrayBuffer()

    // Moderate before uploading — nothing reaches Blob if flagged
    const moderation = await moderateImage(buffer, contentType)
    if (!moderation.safe) {
      return Response.json({ error: moderation.reason }, { status: 422 })
    }

    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const { url } = await put(`headshots/${session.user.id}/headshot.${ext}`, buffer, {
      access: 'public',
      contentType,
    })

    await setHeadshotUrl(session.user.id, url)
    return Response.json({ ok: true, url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[headshot import-linkedin]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
