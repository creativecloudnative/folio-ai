'use client'

import { signOutAction } from '@/app/actions/auth'

type Props = { className?: string; children: React.ReactNode }

export default function SignOutButton({ className, children }: Props) {
  return (
    <form action={signOutAction} className="contents">
      <button type="submit" className={className}>{children}</button>
    </form>
  )
}
