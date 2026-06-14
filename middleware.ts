import { auth } from '@/auth'

// Runs on every request at the edge — reads session from JWT cookie,
// makes it available to server components and route handlers.
// No routes are blocked here; gating is enforced per-action server-side.
export default auth

export const config = {
  // Exclude static assets and the chat API (chat route calls auth() internally;
  // running Edge middleware on a streaming route can buffer the SSE response)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/chat|api/studio/chat|api/folio-ai|api/webhooks).*)'],
  // Note: api/chat covers api/chat/extract; api/folio-ai covers all folio SSE routes
}
