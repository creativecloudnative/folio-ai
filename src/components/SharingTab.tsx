'use client'

import { useState, useRef } from 'react'

type Props = {
  folioSlug: string
  initialIsPublic: boolean
  initialInvites: string[]
}

export default function SharingTab({ folioSlug, initialIsPublic, initialInvites }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [invites, setInvites] = useState<string[]>(initialInvites)
  const [visibilityLoading, setVisibilityLoading] = useState(false)
  const [visibilityError, setVisibilityError] = useState<string | null>(null)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function setVisibility(next: boolean) {
    setVisibilityLoading(true)
    setVisibilityError(null)
    try {
      const res = await fetch(`/api/folio-ai/${folioSlug}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: next }),
      })
      if (!res.ok) throw new Error('Failed to update visibility')
      setIsPublic(next)
    } catch {
      setVisibilityError('Something went wrong. Try again.')
    } finally {
      setVisibilityLoading(false)
    }
  }

  async function addInvite() {
    const email = inviteInput.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setInviteError('Enter a valid email address.')
      return
    }
    if (invites.includes(email)) {
      setInviteError('That email is already on the list.')
      return
    }
    setInviteLoading(true)
    setInviteError(null)
    try {
      const res = await fetch(`/api/folio-ai/${folioSlug}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Failed to add invite')
      setInvites(prev => [...prev, email])
      setInviteInput('')
      inputRef.current?.focus()
    } catch {
      setInviteError('Something went wrong. Try again.')
    } finally {
      setInviteLoading(false)
    }
  }

  async function removeInvite(email: string) {
    setRemovingEmail(email)
    try {
      const res = await fetch(`/api/folio-ai/${folioSlug}/invites`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Failed to remove invite')
      setInvites(prev => prev.filter(e => e !== email))
    } catch {
      // silently fail — the email stays in the list
    } finally {
      setRemovingEmail(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-xl space-y-5">

      {/* Folio visibility toggle */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Folio visibility</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isPublic
                ? 'Your folio is public — anyone with the link can view it.'
                : 'Your folio is private — only you and invited visitors can view it.'}
            </p>
          </div>
          <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium ${
            isPublic
              ? 'border-emerald-700/60 bg-emerald-900/20 text-emerald-400'
              : 'border-zinc-600 bg-zinc-800 text-zinc-400'
          }`}>
            {isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {isPublic ? (
            <button
              onClick={() => setVisibility(false)}
              disabled={visibilityLoading}
              className="text-sm px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-40 transition-colors"
            >
              {visibilityLoading ? 'Saving…' : 'Make private'}
            </button>
          ) : (
            <button
              onClick={() => setVisibility(true)}
              disabled={visibilityLoading}
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
            >
              {visibilityLoading ? 'Saving…' : 'Make public'}
            </button>
          )}
          {visibilityError && <p className="text-xs text-red-400">{visibilityError}</p>}
        </div>
      </section>

      {/* Allowed visitors — only shown when private */}
      {!isPublic && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Allowed visitors</h2>
          <p className="text-sm text-zinc-400 leading-relaxed mb-5">
            Invite specific people by LinkedIn email. They must be signed in to view your folio.
          </p>

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="email"
              value={inviteInput}
              onChange={e => { setInviteInput(e.target.value); setInviteError(null) }}
              onKeyDown={e => e.key === 'Enter' && addInvite()}
              placeholder="colleague@company.com"
              className="flex-1 text-sm bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={addInvite}
              disabled={inviteLoading || !inviteInput.trim()}
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors shrink-0"
            >
              {inviteLoading ? 'Adding…' : 'Add'}
            </button>
          </div>
          {inviteError && <p className="text-xs text-red-400 mt-2">{inviteError}</p>}

          {invites.length > 0 && (
            <ul className="mt-4 space-y-2">
              {invites.map(email => (
                <li
                  key={email}
                  className="flex items-center justify-between gap-3 text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5"
                >
                  <span className="truncate">{email}</span>
                  <button
                    onClick={() => removeInvite(email)}
                    disabled={removingEmail === email}
                    className="text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors shrink-0"
                    aria-label={`Remove ${email}`}
                  >
                    {removingEmail === email ? '…' : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {invites.length === 0 && (
            <p className="mt-4 text-xs text-zinc-600">No visitors invited yet.</p>
          )}
        </section>
      )}

    </div>
  )
}
