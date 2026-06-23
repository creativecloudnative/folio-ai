import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { put, list, del } from '@vercel/blob'
import { moderateImage } from '@/lib/image-moderation'

export const dynamic = 'force-dynamic'

const MAX_REFS = 4
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function refPrefix(userId: string) {
  return `headshots/${userId}/refs/`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const { blobs } = await list({ prefix: refPrefix(session.user.id) })
  return Response.json({ refs: blobs.map((b) => ({ url: b.url, pathname: b.pathname })) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'file required' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Image must be under 5 MB' }, { status: 400 })
  }

  const { blobs: existing } = await list({ prefix: refPrefix(session.user.id) })
  if (existing.length >= MAX_REFS) {
    return Response.json({ error: `Maximum ${MAX_REFS} reference photos allowed` }, { status: 400 })
  }

  try {
    const buffer = await file.arrayBuffer()

    const moderation = await moderateImage(buffer, file.type)
    if (!moderation.safe) {
      return Response.json({ error: moderation.reason }, { status: 422 })
    }

    const ext = file.type.split('/')[1]
    const key = `${refPrefix(session.user.id)}${crypto.randomUUID()}.${ext}`
    const { url } = await put(key, buffer, { access: 'public', contentType: file.type })

    return Response.json({ ok: true, url, pathname: key })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[headshot references POST]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let body: { url: string }
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  // Ensure this URL belongs to this user's refs prefix before deleting
  if (!body.url || !body.url.includes(refPrefix(session.user.id))) {
    return Response.json({ error: 'invalid url' }, { status: 400 })
  }

  try {
    await del(body.url)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[headshot references DELETE]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
