import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getFolioBySlug, getTokenBalance } from '@/lib/folios'
import StudioTabs from '@/components/StudioTabs'

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
  if (folio.owner_id !== session.user.id) redirect(`/folio-ai/${slug}`)

  const balance = await getTokenBalance(folio.owner_id)

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
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{session.user.name}</span>
          <span>·</span>
          <a href={`/folio-ai/${slug}`} className="hover:text-zinc-300 transition-colors">
            View folio
          </a>
          <span>·</span>
          <Link href="/" className="hover:text-zinc-300 transition-colors">
            Home
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <StudioTabs initialBalance={balance} folioSlug={slug} />
      </div>
    </div>
  )
}
