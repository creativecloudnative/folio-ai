import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export const metadata = {
  title: 'Studio — folio-ai',
  robots: 'noindex, nofollow',
}

export default async function StudioPage() {
  const session = await auth()
  if (!session?.user) redirect('/')
  if (!session.user.folioSlug) redirect('/')
  redirect(`/folio-ai/${session.user.folioSlug}/design`)
}
