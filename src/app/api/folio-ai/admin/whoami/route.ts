import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const adminEmail = process.env.ADMIN_EMAIL ?? '(not set)'
  return Response.json({
    sessionEmail: session?.user?.email ?? null,
    adminEmail,
    match: session?.user?.email === process.env.ADMIN_EMAIL,
  })
}
