import { getFolioBySlug, type Folio } from '@/lib/folios'

type SessionLike = { user?: { id?: string | null; email?: string | null } | null } | null

// Returns the folio's owner_id if the folio has studio_full_access enabled —
// allows unauthenticated visitors to use owner-only tabs on demo folios.
export async function resolveFullAccessOwner(slug: string): Promise<string | null> {
  const folio = await getFolioBySlug(slug)
  if (!folio || !folio.studio_full_access || !folio.studio_is_public) return null
  return folio.owner_id
}

// Returns the folio if the session user has read access to the studio.
// Access is granted when the studio is public, or when the user is the owner
// (matched by owner_id or email to handle auth provider ID migrations).
export async function resolveStudioOwner(slug: string, session: SessionLike): Promise<Folio | null> {
  const folio = await getFolioBySlug(slug)
  if (!folio) return null
  if (folio.studio_is_public) return folio
  if (!session?.user) return null
  if (folio.owner_id === session.user.id) return folio
  if (session.user.email && folio.email === session.user.email) return folio
  return null
}
