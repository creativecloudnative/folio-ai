# ADR-003: Authentication Strategy

**Date:** 2026-06-09  
**Status:** Accepted

---

## Context

folio-ai needs to identify visitors who want to perform high-value actions — specifically scheduling a meeting and generating a tailored resume. The goals are:

1. Give the portfolio owner visibility into who is engaging (name, professional identity)
2. Reduce bot/abuse surface on expensive agent actions
3. Keep the visitor experience frictionless for passive browsing and general Q&A
4. Avoid introducing infrastructure complexity for a portfolio project on a 100-hour budget

The site is a single-owner, public-facing portfolio — not a multi-tenant product. Auth requirements are therefore much lighter than a typical SaaS application.

---

## Decisions

### 1. Identity Provider: LinkedIn OAuth via Auth.js v5

**Chosen:** LinkedIn OIDC via Auth.js v5 (NextAuth)  
**Rejected:** GitHub OAuth, email/password, magic links, Clerk (managed service)

**Rationale:** The primary audience is recruiters and hiring managers. LinkedIn is the professional identity layer they already use daily — asking them to sign in with LinkedIn is zero friction and directly aligned with the context. It also provides the most useful identity signal: name, professional email, and profile photo. Auth.js v5 has a built-in LinkedIn provider, is purpose-built for Next.js App Router, and requires no managed auth service (consistent with the OSS template ethos).

---

### 2. Session Strategy: JWT (stateless, no database)

**Chosen:** JWT sessions stored in an HTTP-only cookie, signed with `AUTH_SECRET`  
**Rejected:** Database sessions (Neon/Postgres)

**Rationale:**

JWT sessions store the user's identity claims (name, email, profile photo, LinkedIn sub) in a signed cookie. The server verifies the signature on each request — no database read required. This has three concrete benefits for this project:

- **Edge compatibility.** Next.js middleware runs on the Edge Runtime, which cannot open TCP connections to a Postgres database. JWT verification is pure cryptography and works natively on the Edge, keeping session reads fast and infrastructure-free.
- **Zero additional services.** The project already has enough moving parts (Vercel, Neon for RAG, Cal.com, Anthropic). Adding a database dependency purely for session storage adds operational overhead with no benefit at this scale.
- **Fits the use case.** A portfolio site has no requirement to invalidate sessions server-side (e.g., "log out all devices" or "revoke on role change"). Sessions can be short-lived (24–48h) and the JWT approach is fully sufficient.

**Tradeoffs accepted:**

- Sessions cannot be individually revoked before expiry. If a JWT is stolen, it remains valid until it expires. Mitigation: short expiry window (configured in Auth.js) and HTTPS-only cookies.
- Session data is fixed at sign-in time. If the user updates their LinkedIn profile, the session won't reflect it until they sign in again. Acceptable for this use case.

---

### 3. Gate Model: Soft Gate (action-level, not route-level)

**Chosen:** Soft gate — all routes and browsing are fully public; auth is required only at the moment a gated action is invoked  
**Rejected:** Hard gate — redirecting unauthenticated users to a sign-in page before they can access any feature

**Rationale:** The portfolio's primary job is to convert a passive visitor into an engaged conversation. A login wall at the entry point would cause significant drop-off — recruiters landing from a LinkedIn message or job posting do not expect to authenticate before reading a portfolio. Gating at the action level preserves the open, low-friction experience for 90% of visitors while still capturing identity for the 10% who want to take a meaningful action.

**Gated actions (current):**
- `schedule_meeting` agent tool — requires a valid session before the Cal.com booking flow is initiated
- `/api/resume` — requires a valid session before the tailored resume is returned

**Implementation pattern for gated Route Handlers:**
```ts
const session = await auth()
if (!session) {
  return Response.json(
    { error: 'signin_required', signInUrl: '/api/auth/signin/linkedin' },
    { status: 401 }
  )
}
```

The client handles a 401 response by surfacing a LinkedIn sign-in prompt inline — no page redirect, no lost context.

---

## Remediation Plan: Migrating to Database Sessions

If requirements change and database sessions become necessary (e.g., server-side session revocation, session analytics, or multi-device logout), the migration path is well-defined:

### Trigger conditions
- Need to invalidate specific sessions before expiry (e.g., security incident)
- Need a persistent audit log of who took which actions and when
- Rate limiting needs to be tied to session identity rather than IP

### Migration steps

1. **Add Auth.js database adapter for Neon:**
   ```ts
   import { NeonAdapter } from '@auth/neon-adapter'
   import { Pool } from '@neondatabase/serverless'

   export const { handlers, auth, signIn, signOut } = NextAuth({
     adapter: NeonAdapter(new Pool({ connectionString: process.env.DATABASE_URL })),
     session: { strategy: 'database' },
     // ...
   })
   ```

2. **Move session reads out of middleware** — Edge Runtime cannot run the Neon serverless driver in all configurations. Session checks move from middleware into individual Route Handlers and Server Components, where the Node.js runtime is available. This trades the "check on every request at the edge" benefit for per-handler checks, which is acceptable since only a small number of routes are session-sensitive.

3. **Alternative: keep middleware with `@neondatabase/serverless` HTTP driver** — Neon's serverless driver supports an HTTP transport mode that is Edge-compatible. This preserves middleware-level session reads but requires verifying compatibility with the Auth.js adapter version in use at migration time.

4. **Schema:** Auth.js provides a standard database schema for sessions, accounts, and users. Run the migration against the existing Neon instance (same database used for pgvector/RAG).

5. **No application logic changes required** — gated Route Handlers call `await auth()` in both strategies. The session object shape is identical. Only the Auth.js config and the middleware strategy change.

### Estimated effort: 3–4 hours

---

## Consequences

- `AUTH_SECRET`, `AUTH_LINKEDIN_ID`, and `AUTH_LINKEDIN_SECRET` are required environment variables — documented in `.env.local.example`
- LinkedIn Developer App must have the "Sign In with LinkedIn using OpenID Connect" product enabled and the correct redirect URIs registered
- All gated Route Handlers are responsible for their own session check — middleware does not enforce auth on any route
- Future gated features follow the established pattern: check session, return 401 with `signInUrl` if absent, surface inline sign-in prompt in the UI
