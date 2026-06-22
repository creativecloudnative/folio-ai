import { auth } from '@/auth'
import { getFolioByOwnerId } from '@/lib/folios'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response(null, { status: 401 })

  const folio = await getFolioByOwnerId(session.user.id)
  if (!folio?.headshot_url) return new Response(null, { status: 404 })

  const res = await fetch(folio.headshot_url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  })
  if (!res.ok) return new Response(null, { status: 502 })

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=60',
    },
  })
}
