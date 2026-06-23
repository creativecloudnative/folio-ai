import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getResume, updateResume, deleteResume, type ResumeTemplate } from '@/lib/resumes'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// ── GET /api/studio/resumes/[id] ──────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const { id } = await params
  const resume = await getResume(id, session.user.id)
  if (!resume) return Response.json({ error: 'not_found' }, { status: 404 })

  return Response.json({ resume })
}

// ── PATCH /api/studio/resumes/[id] ────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { content?: string; title?: string; template?: ResumeTemplate }

  const resume = await updateResume(id, session.user.id, body)
  if (!resume) return Response.json({ error: 'not_found' }, { status: 404 })

  return Response.json({ resume })
}

// ── DELETE /api/studio/resumes/[id] ───────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const { id } = await params
  const deleted = await deleteResume(id, session.user.id)
  if (!deleted) return Response.json({ error: 'not_found' }, { status: 404 })

  return Response.json({ ok: true })
}
