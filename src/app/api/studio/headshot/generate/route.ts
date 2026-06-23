import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import OpenAI from 'openai'
import { getFolioByOwnerId, checkAndConsumeImageGen } from '@/lib/folios'

export const dynamic = 'force-dynamic'

const STYLE_PROMPTS: Record<string, string> = {
  professional: 'Professional headshot, studio lighting, neutral background',
  bw:           'Professional headshot in black and white, high contrast, studio lighting',
  illustrated:  'Illustrated avatar portrait, clean vector art style, professional',
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Image generation is not configured' }, { status: 503 })
  }
  const openai = new OpenAI()

  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  let style = 'professional'
  try {
    const body = await req.json()
    if (body.style && STYLE_PROMPTS[body.style]) style = body.style
  } catch { /* default to professional */ }

  const folio = await getFolioByOwnerId(session.user.id)
  if (!folio) return Response.json({ error: 'not_found' }, { status: 404 })
  if (!folio.headshot_url) {
    return Response.json({ error: 'Upload a headshot first before generating' }, { status: 400 })
  }

  const { ok, remaining } = await checkAndConsumeImageGen(session.user.id)
  if (!ok) {
    return Response.json({ error: 'Monthly image generation quota exhausted', remaining: 0 }, { status: 429 })
  }

  const baseRes = await fetch(folio.headshot_url)
  if (!baseRes.ok) return Response.json({ error: 'Could not load current headshot' }, { status: 502 })
  const baseBuffer = await baseRes.arrayBuffer()
  const contentType = baseRes.headers.get('content-type') ?? 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const baseFile = new File([baseBuffer], `headshot.${ext}`, { type: contentType })

  try {
    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: baseFile,
      prompt: STYLE_PROMPTS[style],
      size: '1024x1024',
    })

    const b64 = (result as { data?: Array<{ b64_json?: string | null }> }).data?.[0]?.b64_json
    if (!b64) return Response.json({ error: 'Image generation failed — please try again' }, { status: 502 })

    return Response.json({ ok: true, dataUrl: `data:image/png;base64,${b64}`, remaining })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[headshot generate]', message)
    return Response.json({ error: message }, { status: 502 })
  }
}
