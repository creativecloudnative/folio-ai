'use client'

import { signOut } from 'next-auth/react'

type Props = { className?: string; children: React.ReactNode }

export default function SignOutButton({ className, children }: Props) {
  return (
    <button onClick={() => signOut()} className={className}>
      {children}
    </button>
  )
}
