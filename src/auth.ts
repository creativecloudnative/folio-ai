import NextAuth from 'next-auth'
import LinkedIn from 'next-auth/providers/linkedin'
import Credentials from 'next-auth/providers/credentials'
import { upsertFolioOnLogin } from '@/lib/folios'
import { isAdminEmail } from '@/lib/admin'

const devProvider = process.env.NODE_ENV === 'development'
  ? [Credentials({
      name: 'Dev Login',
      credentials: {
        name:  { label: 'Name',  type: 'text',  placeholder: 'Dev User' },
        email: { label: 'Email', type: 'email', placeholder: 'dev@localhost' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        if (!email) return null
        const name = (credentials?.name as string | undefined) || 'Dev User'
        return { id: `dev-${email}`, name, email, image: null }
      },
    })]
  : []

// LinkedIn's OIDC discovery endpoint reliably returns non-200, breaking
// Auth.js provider init. Bypass it with type:"oauth" and hardcoded endpoints.
// The /v2/userinfo shape (sub, name, email, picture) matches the OIDC claims.
// clientId/clientSecret must be set directly on the object — Auth.js env-var
// injection only runs on provider function refs, not spread objects.
const linkedInProvider = {
  ...LinkedIn({}),
  clientId:     process.env.AUTH_LINKEDIN_ID,
  clientSecret: process.env.AUTH_LINKEDIN_SECRET,
  type:   'oauth'   as const,
  checks: ['state'] as ('state' | 'pkce' | 'none')[],
  authorization: {
    url: 'https://www.linkedin.com/oauth/v2/authorization',
    params: { scope: 'openid profile email', response_type: 'code' },
  },
  token:    'https://www.linkedin.com/oauth/v2/accessToken',
  userinfo: 'https://api.linkedin.com/v2/userinfo',
  profile(profile: { sub: string; name: string; email: string; picture?: string }) {
    return {
      id:    profile.sub,
      name:  profile.name,
      email: profile.email,
      image: profile.picture ?? null,
    }
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    linkedInProvider,
    ...devProvider,
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // LinkedIn OAuth — first sign-in: account + user are populated by profile()
      if (account?.provider === 'linkedin' && user) {
        token.sub     = user.id    as string
        token.picture = user.image as string
        if (user.name && user.email) {
          try {
            const folio = await upsertFolioOnLogin(user.id as string, user.name, user.email)
            token.folioSlug = folio.slug
          } catch (err) {
            console.error('[folio-ai jwt-folio-error]', err instanceof Error ? err.message : err)
          }
        }
      }

      // Existing OIDC sessions carry profile on token refresh — keep them alive
      if (!account && profile) {
        token.sub     = (profile.sub     as string | undefined) ?? token.sub
        token.picture = (profile.picture as string | undefined) ?? token.picture
      }

      // Dev credentials — user is the object returned by authorize()
      if (account?.type === 'credentials' && user) {
        token.sub = user.id as string
        if (user.name && user.email && !isAdminEmail(user.email)) {
          try {
            const folio = await upsertFolioOnLogin(user.id as string, user.name, user.email)
            token.folioSlug = folio.slug
          } catch (err) {
            console.error('[folio-ai jwt-dev-error]', err instanceof Error ? err.message : err)
          }
        }
      }

      return token
    },
    session({ session, token }) {
      if (token.sub)       session.user.id        = token.sub
      if (token.picture)   session.user.image     = token.picture   as string
      if (token.folioSlug) session.user.folioSlug = token.folioSlug as string
      return session
    },
  },
})
