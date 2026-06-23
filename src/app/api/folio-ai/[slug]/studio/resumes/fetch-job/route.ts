import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { fetchJobDescription } from '@/lib/resumes'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })

  const { url } = await req.json() as { url?: string }
  if (!url?.trim()) return Response.json({ error: 'url is required' }, { status: 400 })

  let parsed: URL
  try { parsed = new URL(url.trim()) } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return Response.json({ error: 'URL must be http or https' }, { status: 400 })
  }

  try {
    const text = await fetchJobDescription(url.trim())
    return Response.json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch URL'
    return Response.json({ error: msg }, { status: 422 })
  }
}
