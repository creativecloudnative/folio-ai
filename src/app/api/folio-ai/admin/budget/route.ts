import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

function isAdmin(email: string | null | undefined): boolean {
  const ownerEmail = process.env.OWNER_EMAIL
  return !!ownerEmail && email === ownerEmail
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { folioId: string; token_budget?: number; reset_used?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { folioId, token_budget, reset_used } = body

  if (!folioId) return Response.json({ error: 'folioId required' }, { status: 400 })

  if (token_budget !== undefined) {
    if (!Number.isInteger(token_budget) || token_budget < 0) {
      return Response.json({ error: 'token_budget must be a non-negative integer' }, { status: 400 })
    }
    await sql`UPDATE folios SET token_budget = ${token_budget} WHERE id = ${folioId}`
  }

  if (reset_used) {
    await sql`UPDATE folios SET tokens_used = 0 WHERE id = ${folioId}`
  }

  return Response.json({ ok: true })
}
