import NextAuth from 'next-auth'
import LinkedIn from 'next-auth/providers/linkedin'
import Credentials from 'next-auth/providers/credentials'
import { upsertFolioOnLogin } from '@/lib/folios'

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [LinkedIn, ...devProvider],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // LinkedIn OAuth — profile contains the raw provider data
      if (profile) {
        token.sub = profile.sub as string
        token.picture = profile.picture as string
        if (profile.name && profile.email) {
          try {
            const folio = await upsertFolioOnLogin(
              token.sub as string,
              profile.name as string,
              profile.email as string,
            )
            token.folioSlug = folio.slug
          } catch (err) {
            console.error('[folio-ai jwt-folio-error]', err instanceof Error ? err.message : err)
          }
        }
      }

      // Dev credentials — user is the object returned by authorize()
      if (account?.type === 'credentials' && user) {
        token.sub = user.id as string
        if (user.name && user.email) {
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
      if (token.sub) session.user.id = token.sub
      if (token.picture) session.user.image = token.picture as string
      if (token.folioSlug) session.user.folioSlug = token.folioSlug as string
      return session
    },
  },
})
