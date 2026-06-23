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

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const body = await req.json() as Partial<{ title: string; content: string }>
  const resume = await updateResume(id, ownerId, body)
  if (!resume) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ resume })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const ownerId = await resolveFullAccessOwner(slug)
  if (!ownerId) return Response.json({ error: 'not_found' }, { status: 404 })
  const deleted = await deleteResume(id, ownerId)
  if (!deleted) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ ok: true })
}
