import { NextRequest } from 'next/server'
import { getFolioBySlug } from '@/lib/folios'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const folio = await getFolioBySlug(slug)

  if (!folio?.headshot_url || !folio.headshot_visible) return new Response(null, { status: 404 })

  // Public blob URLs are CDN-served — no auth header needed or accepted
  const res = await fetch(folio.headshot_url)
  if (!res.ok) return new Response(null, { status: 502 })

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
