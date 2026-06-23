import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { setHeadshotUrl, getFolioByOwnerId } from '@/lib/folios'
import { moderateImage } from '@/lib/image-moderation'
import { headshotKey, pruneHeadshotHistory } from '@/lib/headshot-storage'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'file required' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Image must be under 5 MB' }, { status: 400 })
  }

  try {
    const buffer = await file.arrayBuffer()

    // Moderate before uploading — nothing reaches Blob if flagged
    const moderation = await moderateImage(buffer, file.type)
    if (!moderation.safe) {
      return Response.json({ error: moderation.reason }, { status: 422 })
    }

    const ext = file.type.split('/')[1]
    const { url } = await put(headshotKey(session.user.id, ext), buffer, {
      access: 'public',
      contentType: file.type,
    })
    const folio = await getFolioByOwnerId(session.user.id)
    await setHeadshotUrl(session.user.id, url)
    pruneHeadshotHistory(session.user.id, folio?.headshot_url ?? null).catch(() => {})
    return Response.json({ ok: true, url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[headshot upload]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
