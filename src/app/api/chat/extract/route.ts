import { NextRequest } from 'next/server'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

type ExtractBody = {
  content: string        // base64
  fileType: 'pdf' | 'docx'
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  let body: ExtractBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { content, fileType } = body
  if (!content || !fileType) {
    return Response.json({ error: 'content and fileType are required' }, { status: 400 })
  }

  const buffer = Buffer.from(content, 'base64')

  try {
    let text: string

    if (fileType === 'pdf') {
      const { extractText } = await import('unpdf')
      const { text: pages } = await extractText(new Uint8Array(buffer))
      text = Array.isArray(pages) ? pages.join('\n') : (pages as string)
    } else {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    }

    if (!text.trim()) {
      return Response.json({ error: 'No text could be extracted from the file' }, { status: 422 })
    }

    return Response.json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed'
    return Response.json({ error: msg }, { status: 422 })
  }
}
