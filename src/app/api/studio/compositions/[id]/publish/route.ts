import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { publishCompositionById } from '@/lib/publish-composition'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'signin_required' }, { status: 401 })

  const { id } = await params
  try {
    const { source } = await publishCompositionById(id, session.user.id)
    const folioSlug = session.user.folioSlug ?? ''
    revalidatePath(`/folio-ai/${folioSlug}`)
    return Response.json({ ok: true, source })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed'
    return Response.json({ error: message }, { status: message === 'Composition not found' ? 404 : 422 })
  }
}
