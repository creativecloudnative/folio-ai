import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { fetchJobDescription } from '@/lib/resumes'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function POST() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}
