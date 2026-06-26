import { sql } from './db'

export const ANON_TOKEN_BUDGET = 10_000

export type AnonTokenBalance = {
  remaining: number
  budget: number
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS anon_sessions (
      id           TEXT         PRIMARY KEY,
      tokens_used  INTEGER      NOT NULL DEFAULT 0,
      token_budget INTEGER      NOT NULL DEFAULT ${ANON_TOKEN_BUDGET},
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `
}

export async function getOrCreateAnonSession(
  sessionId: string,
): Promise<{ tokens_used: number; token_budget: number }> {
  await ensureTable()
  const rows = await sql`
    INSERT INTO anon_sessions (id)
    VALUES (${sessionId})
    ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
    RETURNING tokens_used, token_budget
  `
  return rows[0] as { tokens_used: number; token_budget: number }
}

export async function consumeAnonTokens(
  sessionId: string,
  amount: number,
): Promise<AnonTokenBalance> {
  const rows = await sql`
    UPDATE anon_sessions
    SET tokens_used = tokens_used + ${amount}
    WHERE id = ${sessionId}
    RETURNING tokens_used, token_budget
  `
  if (rows.length === 0) return { remaining: 0, budget: ANON_TOKEN_BUDGET }
  const { tokens_used, token_budget } = rows[0] as { tokens_used: number; token_budget: number }
  return {
    remaining: Math.max(0, token_budget - tokens_used),
    budget: token_budget,
  }
}
