'use client'

import { signIn } from 'next-auth/react'

type Props = {
  className?: string
  children: React.ReactNode
}

export default function SignInButton({ className, children }: Props) {
  return (
    <button
      onClick={() => signIn('linkedin', { callbackUrl: window.location.href })}
      className={className}
    >
      {children}
    </button>
  )
}
