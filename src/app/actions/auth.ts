'use server'
import { signOut } from '@/auth'

export async function signOutAction() {
  // Clear our session first, then redirect through LinkedIn's logout to
  // destroy the LinkedIn SSO session — prevents auto-login on next sign-in.
  await signOut({ redirectTo: 'https://www.linkedin.com/m/logout' })
}
