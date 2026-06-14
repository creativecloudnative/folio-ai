'use server'
import { signOut } from '@/auth'
import { cookies } from 'next/headers'

export async function signOutAction() {
  const cookieStore = await cookies()

  // Clear any lingering OAuth state/PKCE/nonce cookies from interrupted flows
  // before calling signOut() which handles the session token.
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.includes('next-auth') || cookie.name.includes('authjs')) {
      cookieStore.delete(cookie.name)
    }
  }

  await signOut({ redirectTo: '/folio-ai' })
}
