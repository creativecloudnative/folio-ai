import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import {
  getFolioVideos,
  addFolioVideo,
  removeFolioVideo,
  updateFolioVideoDescription,
  extractYouTubeId,
  fetchVideoMetadata,
} from '@/lib/videos'

export const dynamic = 'force-dynamic'

async function resolveOwned(slug: string, userId: string) {
  const folio = await getFolioBySlug(slug)
  if (!folio) return null
  if (folio.owner_id !== userId) return null
  return folio
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const folio = await getFolioBySlug(slug)
  if (!folio) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const videos = await getFolioVideos(folio.id)
  return NextResponse.json({ videos })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folio = await resolveOwned(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
  const videoId = extractYouTubeId(rawUrl)
  if (!videoId) {
    return NextResponse.json({ error: 'Could not extract a YouTube video ID from that URL.' }, { status: 422 })
  }

  let title: string
  let thumbnail_url: string
  try {
    const meta = await fetchVideoMetadata(videoId)
    title = meta.title
    thumbnail_url = meta.thumbnail_url
  } catch {
    return NextResponse.json({ error: 'Could not fetch video metadata. Make sure the video is public.' }, { status: 422 })
  }

  const description = typeof body.description === 'string' ? body.description.trim() || null : null
  const video = await addFolioVideo(folio.id, videoId, title, thumbnail_url, description)
  return NextResponse.json({ video }, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folio = await resolveOwned(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, description } = body as { id: string; description: string | null }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await updateFolioVideoDescription(id, folio.id, description?.trim() || null)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const [session, { slug }] = await Promise.all([auth(), params])
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folio = await resolveOwned(slug, session.user.id)
  if (!folio) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await removeFolioVideo(id, folio.id)
  return NextResponse.json({ ok: true })
}
