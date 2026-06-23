import { NextRequest } from 'next/server'
import { resolveFullAccessOwner } from '@/lib/studio-access'
import { getResume, updateResume, deleteResume } from '@/lib/resumes'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string; id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const resume = await getResume(id, ownerId)
  if (!resume) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ resume })
}

export async function PATCH() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}

export async function DELETE() {
  return Response.json({ error: 'demo_read_only' }, { status: 403 })
}
