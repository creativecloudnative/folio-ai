'use client'

type Props = { className?: string; children: React.ReactNode }

export default function SignOutButton({ className, children }: Props) {
  return (
    <a href="/api/folio-ai/auth/signout" className={className}>
      {children}
    </a>
  )
}
