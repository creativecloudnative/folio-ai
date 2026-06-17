import { sql } from './db'

export type FolioVideo = {
  id: string
  folio_id: string
  video_id: string
  title: string
  thumbnail_url: string
  description: string | null
  position: number
  created_at: string
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS folio_videos (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      folio_id      UUID         NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
      video_id      TEXT         NOT NULL,
      title         TEXT         NOT NULL,
      thumbnail_url TEXT         NOT NULL,
      description   TEXT,
      position      INTEGER      NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      UNIQUE(folio_id, video_id)
    )
  `
}

export function extractYouTubeId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('?')[0]
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v) return v
      // /embed/ID or /shorts/ID
      const match = url.pathname.match(/\/(embed|shorts|v)\/([^/?]+)/)
      if (match) return match[2]
    }
  } catch {
    // bare video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim()
  }
  return null
}

export async function fetchVideoMetadata(videoId: string): Promise<{ title: string; thumbnail_url: string }> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  const res = await fetch(oembedUrl, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`YouTube oEmbed returned ${res.status}`)
  const data = await res.json() as { title: string; thumbnail_url: string }
  return { title: data.title, thumbnail_url: data.thumbnail_url }
}

export async function getFolioVideos(folioId: string): Promise<FolioVideo[]> {
  await ensureTable()
  const rows = await sql`
    SELECT id, folio_id, video_id, title, thumbnail_url, description, position, created_at
    FROM folio_videos WHERE folio_id = ${folioId}
    ORDER BY position, created_at
  `
  return rows as FolioVideo[]
}

export async function addFolioVideo(
  folioId: string,
  videoId: string,
  title: string,
  thumbnailUrl: string,
  description: string | null,
): Promise<FolioVideo> {
  await ensureTable()
  const rows = await sql`
    INSERT INTO folio_videos (folio_id, video_id, title, thumbnail_url, description, position)
    VALUES (
      ${folioId}, ${videoId}, ${title}, ${thumbnailUrl}, ${description},
      COALESCE((SELECT MAX(position) + 1 FROM folio_videos WHERE folio_id = ${folioId}), 0)
    )
    ON CONFLICT (folio_id, video_id) DO UPDATE
      SET title = EXCLUDED.title, thumbnail_url = EXCLUDED.thumbnail_url
    RETURNING id, folio_id, video_id, title, thumbnail_url, description, position, created_at
  `
  return rows[0] as FolioVideo
}

export async function updateFolioVideoDescription(
  id: string,
  folioId: string,
  description: string | null,
): Promise<void> {
  await sql`
    UPDATE folio_videos SET description = ${description}
    WHERE id = ${id} AND folio_id = ${folioId}
  `
}

export async function removeFolioVideo(id: string, folioId: string): Promise<void> {
  await sql`DELETE FROM folio_videos WHERE id = ${id} AND folio_id = ${folioId}`
}
