import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// NextAuth v5 JWT cookie names (dev and prod variants)
const AUTH_COOKIES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'authjs.session-token',
  '__Secure-authjs.session-token',
]

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/folio-ai', req.url))
  for (const name of AUTH_COOKIES) {
    res.cookies.delete(name)
  }
  return res
}
