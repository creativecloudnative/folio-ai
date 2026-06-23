import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { fetchJobDescription } from '@/lib/resumes'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const { url } = await req.json() as { url?: string }
  if (!url?.trim()) return Response.json({ error: 'url is required' }, { status: 400 })

  try {
    new URL(url) // validate URL syntax
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const text = await fetchJobDescription(url)
    return Response.json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch URL'
    return Response.json({ error: msg }, { status: 422 })
  }
}
