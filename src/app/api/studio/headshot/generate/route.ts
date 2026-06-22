import { auth } from '@/auth'
import { put } from '@vercel/blob'
import OpenAI from 'openai'
import { getFolioByOwnerId, checkAndConsumeImageGen } from '@/lib/folios'

export const dynamic = 'force-dynamic'

const openai = new OpenAI()
const PROMPT = 'Professional headshot'
const NUM_OPTIONS = 3

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const folio = await getFolioByOwnerId(session.user.id)
  if (!folio) return Response.json({ error: 'not_found' }, { status: 404 })
  if (!folio.headshot_url) {
    return Response.json({ error: 'Upload a headshot first before generating' }, { status: 400 })
  }

  // Check quota and deduct atomically (handles monthly reset)
  const { ok, remaining } = await checkAndConsumeImageGen(session.user.id)
  if (!ok) {
    return Response.json({ error: 'Monthly image generation quota exhausted', remaining: 0 }, { status: 429 })
  }

  // Fetch the current headshot to use as the base image
  const baseRes = await fetch(folio.headshot_url)
  if (!baseRes.ok) return Response.json({ error: 'Could not load current headshot' }, { status: 502 })
  const baseBuffer = await baseRes.arrayBuffer()
  const contentType = baseRes.headers.get('content-type') ?? 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const baseFile = new File([baseBuffer], `headshot.${ext}`, { type: contentType })

  // Generate NUM_OPTIONS in parallel
  const results = await Promise.allSettled(
    Array.from({ length: NUM_OPTIONS }, () =>
      openai.images.edit({
        model: 'gpt-image-1',
        image: baseFile,
        prompt: PROMPT,
        size: '1024x1024',
      })
    )
  )

  const urls: string[] = []
  await Promise.all(
    results.map(async (result, i) => {
      if (result.status === 'rejected') return
      const b64 = result.value.data?.[0]?.b64_json
      if (!b64) return
      const buffer = Buffer.from(b64, 'base64')
      const { url } = await put(
        `headshots/${session.user.id}/generated-${Date.now()}-${i}.png`,
        buffer,
        { access: 'public', contentType: 'image/png' }
      )
      urls.push(url)
    })
  )

  if (urls.length === 0) {
    return Response.json({ error: 'Image generation failed — please try again' }, { status: 502 })
  }

  return Response.json({ ok: true, urls, remaining })
}
