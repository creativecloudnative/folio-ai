import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// For JWT sessions the session IS the cookie — deleting it is a complete sign-out.
// We then redirect through LinkedIn's logout to clear their SSO session and
// ensure the credential form appears on the next sign-in.
export async function GET() {
  const cookieStore = await cookies()
  const res = NextResponse.redirect('https://www.linkedin.com/m/logout')

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.includes('next-auth') || cookie.name.includes('authjs')) {
      res.cookies.delete({ name: cookie.name, path: '/' })
    }
  }

  return res
}
