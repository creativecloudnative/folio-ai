import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { ingestDocument, type DocType } from '@/lib/ingest'

export const dynamic = 'force-dynamic'

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx']
const MAX_SIZE_BYTES = 500_000

const VALID_TYPES: DocType[] = ['bio', 'resume', 'case-study', 'architecture', 'journal', 'memory', 'job-req']

async function extractText(content: string, fileType: 'text' | 'pdf' | 'docx'): Promise<string> {
  if (fileType === 'text') return content

  const buffer = Buffer.from(content, 'base64')

  if (fileType === 'pdf') {
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(buffer))
    return Array.isArray(text) ? text.join('\n') : (text as string)
  }

  // docx
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

type UploadBody = {
  filename: string
  content: string        // raw text for .txt/.md, base64 for .pdf/.docx
  fileType: 'text' | 'pdf' | 'docx'
  type: DocType
  isBaseline?: boolean
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  let body: UploadBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { filename, content, fileType, type, isBaseline } = body

  if (!filename || !content || !type) {
    return Response.json({ error: 'filename, content, and type are required' }, { status: 400 })
  }

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return Response.json(
      { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 },
    )
  }

  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }

  if (content.length > MAX_SIZE_BYTES) {
    return Response.json({ error: 'File too large (max 500KB)' }, { status: 400 })
  }

  let text: string
  try {
    text = await extractText(content, fileType)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse failed'
    return Response.json({ error: `Could not extract text from file: ${msg}` }, { status: 422 })
  }

  if (!text.trim()) {
    return Response.json({ error: 'No text could be extracted from the file' }, { status: 422 })
  }

  const ownerId = session.user.id
  const slug = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const source = `upload/${type}/${slug}`
  const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  const metadata = type === 'resume' && isBaseline ? { is_baseline: true } : {}

  const { chunks } = await ingestDocument(type, title, source, text, ownerId, ownerId, metadata)

  console.log('[folio-ai doc-upload]', JSON.stringify({
    timestamp: new Date().toISOString(),
    filename, type, source, chunks, isBaseline: !!isBaseline,
  }))

  return Response.json({ ok: true, chunks, source, title })
}
