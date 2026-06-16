import { getFolioBySlug, type Folio } from '@/lib/folios'
import { isStudioInvited } from '@/lib/studio-invites'

type SessionLike = { user?: { id?: string | null; email?: string | null } | null } | null

export async function resolveStudioOwner(slug: string, session: SessionLike): Promise<Folio | null> {
  if (!session?.user) return null
  const folio = await getFolioBySlug(slug)
  if (!folio) return null
  if (folio.owner_id === session.user.id) return folio
  if (folio.studio_is_public) return folio
  if (session.user.email && await isStudioInvited(folio.id, session.user.email)) return folio
  return null
}
