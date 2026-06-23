import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getFolioBySlug, getTokenBalance } from '@/lib/folios'
import { getFolioInvites } from '@/lib/invites'

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

  if (!folio) notFound()

  // Match by owner_id first; fall back to email to handle auth provider migrations
  // (e.g. LinkedIn legacy ID → OIDC sub → OAuth UUID across Auth.js version changes)
  const isOwner      = !!session?.user && (
    folio.owner_id === session.user.id ||
    (!!session.user.email && folio.email === session.user.email)
  )
  // Full-access: visitor can see and use all owner-only tabs on a demo folio
  const isFullAccess = !isOwner && folio.studio_full_access && folio.studio_is_public

  if (!isOwner) {
    const hasAccess = folio.studio_full_access || folio.studio_is_public
    if (!hasAccess) redirect(`/folio-ai/${slug}`)
  }

  const [balance, invites, videos] = await Promise.all([
    getTokenBalance(folio.owner_id),
    isOwner ? getFolioInvites(folio.id) : Promise.resolve([]),
    getFolioVideos(folio.id),
  ])

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200 shrink-0">
            Studio
          </span>
          <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-2 py-0.5 truncate hidden xs:block sm:block">
            {folio.name}
          </span>
          {!isOwner && !isFullAccess && (
            <span className="text-xs text-amber-400 border border-amber-700/50 bg-amber-900/20 rounded px-2 py-0.5 shrink-0">
              read-only
            </span>
          )}
          {isFullAccess && (
            <span className="text-xs text-emerald-400 border border-emerald-700/50 bg-emerald-900/20 rounded px-2 py-0.5 shrink-0">
              demo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
          <span className="hidden sm:inline">{session?.user?.name}</span>
          <span className="hidden sm:inline">{session?.user && '·'}</span>
          <a href={`/folio-ai/${slug}`} className="px-2.5 py-1.5 sm:px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors whitespace-nowrap">
            View folio
          </a>
          <span className="hidden sm:inline">·</span>
          <Link href="/" className="hidden sm:inline hover:text-zinc-300 transition-colors">
            Home
          </Link>
          {session?.user && (
            <>
              <span className="hidden sm:inline">·</span>
              <SignOutButton className="hidden sm:inline hover:text-zinc-300 transition-colors">
                Sign out
              </SignOutButton>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <StudioTabs
          isViewer={!isOwner && !isFullAccess}
          fullAccessSlug={isFullAccess ? slug : undefined}
          initialBalance={balance}
          folioSlug={slug}
          initialIsPublic={folio.is_public}

          initialInvites={invites}
          initialCalUsername={folio.cal_username}
          initialVideos={videos}
        />
      </div>
    </div>
  )
}
