import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { setHeadshotUrl } from '@/lib/folios'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
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

  const ext = file.type.split('/')[1]
  const { url } = await put(`headshots/${session.user.id}/headshot.${ext}`, file, {
    access: 'public',
    contentType: file.type,
  })

  await setHeadshotUrl(session.user.id, url)
  return Response.json({ ok: true, url })
}
