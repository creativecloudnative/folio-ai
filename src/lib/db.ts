import { neon } from '@neondatabase/serverless'

let _client: ReturnType<typeof neon> | null = null

function getClient() {
  if (!_client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
    _client = neon(process.env.DATABASE_URL)
  }
  return _client
}

// Tagged template literal wrapper — neon() is never called at module
// evaluation time, only on the first actual query. This lets Next.js
// statically evaluate API routes during `next build` without DATABASE_URL.
export const sql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> =>
  getClient()(strings, ...values) as Promise<Record<string, unknown>[]>
