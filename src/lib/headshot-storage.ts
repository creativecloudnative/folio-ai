import { list, del } from '@vercel/blob'

const HISTORY_LIMIT = 10

export function headshotKey(userId: string, ext: string): string {
  const rand = Math.random().toString(36).slice(2, 7)
  return `headshots/${userId}/${Date.now()}-${rand}.${ext}`
}

export type HeadshotEntry = {
  url: string
  pathname: string
  uploadedAt: Date
  isActive: boolean
}

export async function listHeadshotHistory(
  userId: string,
  activeUrl: string | null,
): Promise<HeadshotEntry[]> {
  const { blobs } = await list({ prefix: `headshots/${userId}/` })
  return blobs
    .filter((b) => !b.pathname.includes('/refs/'))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, HISTORY_LIMIT)
    .map((b) => ({
      url: b.url,
      pathname: b.pathname,
      uploadedAt: new Date(b.uploadedAt),
      isActive: b.url === activeUrl,
    }))
}

export async function pruneHeadshotHistory(
  userId: string,
  activeUrl: string | null,
): Promise<void> {
  const { blobs } = await list({ prefix: `headshots/${userId}/` })
  const sorted = blobs
    .filter((b) => !b.pathname.includes('/refs/'))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

  // Keep the most recent HISTORY_LIMIT, never delete the active headshot
  const toDelete = sorted.slice(HISTORY_LIMIT).filter((b) => b.url !== activeUrl)
  if (toDelete.length > 0) {
    await del(toDelete.map((b) => b.url))
  }
}
