import { auth } from '@/auth'
import OpenAI from 'openai'
import { getFolioByOwnerId, checkAndConsumeImageGen } from '@/lib/folios'

export const dynamic = 'force-dynamic'

const PROMPT = 'Professional headshot'
const NUM_OPTIONS = 3

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Image generation is not configured' }, { status: 503 })
  }
  const openai = new OpenAI()

  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const folio = await getFolioByOwnerId(session.user.id)
  if (!folio) return Response.json({ error: 'not_found' }, { status: 404 })
  if (!folio.headshot_url) {
    return Response.json({ error: 'Upload a headshot first before generating' }, { status: 400 })
  }

  const { ok, remaining } = await checkAndConsumeImageGen(session.user.id)
  if (!ok) {
    return Response.json({ error: 'Monthly image generation quota exhausted', remaining: 0 }, { status: 429 })
  }

  // Fetch base image from private Blob using server-side token
  const baseRes = await fetch(folio.headshot_url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  })
  if (!baseRes.ok) return Response.json({ error: 'Could not load current headshot' }, { status: 502 })
  const baseBuffer = await baseRes.arrayBuffer()
  const contentType = baseRes.headers.get('content-type') ?? 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const baseFile = new File([baseBuffer], `headshot.${ext}`, { type: contentType })

  // Generate NUM_OPTIONS in parallel — return base64 data URLs directly (no temp Blob storage)
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

  const dataUrls: string[] = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => {
      const value = (r as PromiseFulfilledResult<{ data?: Array<{ b64_json?: string | null }> }>).value
      const b64 = value.data?.[0]?.b64_json
      return b64 ? `data:image/png;base64,${b64}` : null
    })
    .filter((u): u is string => u !== null)

  if (dataUrls.length === 0) {
    return Response.json({ error: 'Image generation failed — please try again' }, { status: 502 })
  }

  return Response.json({ ok: true, urls: dataUrls, remaining })
}
