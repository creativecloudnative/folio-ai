import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/auth'
import { getFolioBySlug, setFolioVisibility } from '@/lib/folios'

export const metadata = {
  title: 'Settings — folio-ai',
  robots: 'noindex, nofollow',
}

export default async function FolioSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [session, folio] = await Promise.all([auth(), getFolioBySlug(slug)])

  if (!session?.user) redirect(`/folio-ai/${slug}`)
  if (!folio) notFound()
  if (folio.owner_id !== session.user.id) redirect(`/folio-ai/${slug}`)

  async function setPublic() {
    'use server'
    await setFolioVisibility(folio!.owner_id, true)
    revalidatePath(`/folio-ai/${slug}`)
    redirect(`/folio-ai/${slug}/settings`)
  }

  async function setPrivate() {
    'use server'
    await setFolioVisibility(folio!.owner_id, false)
    revalidatePath(`/folio-ai/${slug}`)
    redirect(`/folio-ai/${slug}/settings`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200">Settings</span>
          <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-2 py-0.5">
            {folio.name}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <Link href={`/folio-ai/${slug}/design`} className="hover:text-zinc-300 transition-colors">
            Studio
          </Link>
          <span>·</span>
          <Link href={`/folio-ai/${slug}`} className="hover:text-zinc-300 transition-colors">
            View folio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold text-white mb-8">Folio Settings</h1>

        {/* Visibility */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Visibility</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {folio.is_public
                  ? 'Your folio is public — anyone with the link can view it.'
                  : 'Your folio is private — only you can view it when signed in.'}
              </p>
            </div>
            <span
              className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium ${
                folio.is_public
                  ? 'border-emerald-700/60 bg-emerald-900/20 text-emerald-400'
                  : 'border-zinc-600 bg-zinc-800 text-zinc-400'
              }`}
            >
              {folio.is_public ? 'Public' : 'Private'}
            </span>
          </div>

          <div className="mt-5 flex gap-3">
            {folio.is_public ? (
              <form action={setPrivate}>
                <button
                  type="submit"
                  className="text-sm px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                >
                  Make private
                </button>
              </form>
            ) : (
              <form action={setPublic}>
                <button
                  type="submit"
                  className="text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  Make public
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
