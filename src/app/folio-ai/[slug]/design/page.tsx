import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getFolioBySlug, getTokenBalance } from '@/lib/folios'
import { getFolioInvites } from '@/lib/invites'
import { getStudioInvites, isStudioInvited } from '@/lib/studio-invites'
import { getFolioVideos } from '@/lib/videos'
import StudioTabs from '@/components/StudioTabs'
import SignOutButton from '@/components/SignOutButton'

export const metadata = {
  title: 'Design Studio — folio-ai',
  robots: 'noindex, nofollow',
}

export default async function FolioDesignPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [session, folio] = await Promise.all([auth(), getFolioBySlug(slug)])

  if (!session?.user) redirect(`/folio-ai/${slug}`)
  if (!folio) notFound()

  const isOwner = folio.owner_id === session.user.id

  if (!isOwner) {
    // Check studio access — public studio or explicitly invited
    const hasAccess = folio.studio_is_public ||
      (!!session.user.email && await isStudioInvited(folio.id, session.user.email))
    if (!hasAccess) redirect(`/folio-ai/${slug}`)
  }

  const [balance, invites, studioInvites, videos] = await Promise.all([
    getTokenBalance(folio.owner_id),
    isOwner ? getFolioInvites(folio.id) : Promise.resolve([]),
    isOwner ? getStudioInvites(folio.id) : Promise.resolve([]),
    getFolioVideos(folio.id),
  ])

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200">
            Design Studio
          </span>
          <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-2 py-0.5">
            {folio.name}
          </span>
          {!isOwner && (
            <span className="text-xs text-amber-400 border border-amber-700/50 bg-amber-900/20 rounded px-2 py-0.5">
              read-only
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{session.user.name}</span>
          <span>·</span>
          <a href={`/folio-ai/${slug}`} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
            View folio
          </a>
          <span>·</span>
          <Link href="/" className="hover:text-zinc-300 transition-colors">
            Home
          </Link>
          <span>·</span>
          <SignOutButton className="hover:text-zinc-300 transition-colors">
            Sign out
          </SignOutButton>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <StudioTabs
          isViewer={!isOwner}
          initialBalance={balance}
          folioSlug={slug}
          initialIsPublic={folio.is_public}
          initialStudioIsPublic={folio.studio_is_public}
          initialInvites={invites}
          initialStudioInvites={studioInvites}
          initialCalUsername={folio.cal_username}
          initialVideos={videos}
        />
      </div>
    </div>
  )
}
