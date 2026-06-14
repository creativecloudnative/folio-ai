import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { zipSync, strToU8 } from 'fflate'

export const dynamic = 'force-dynamic'

function sourceToFilePath(source: string, type: string): string {
  if (source.includes('.')) return source
  if (type === 'diagram') return `${source}.md`
  return `${source}.md`
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const sourceParam = url.searchParams.get('source')

  const ownerId = session.user.id

  // Fetch documents — optionally filtered to a single source
  const rows = sourceParam
    ? await sql`
        SELECT type, title, source, content
        FROM documents
        WHERE owner_id = ${ownerId} AND source = ${sourceParam}
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT type, title, source, content
        FROM documents
        WHERE owner_id = ${ownerId}
          AND type NOT IN ('job-req', 'connection', 'memory')
        ORDER BY source, created_at ASC
      `

  if (rows.length === 0) {
    return Response.json({ error: 'no_documents' }, { status: 404 })
  }

  // Single-source download — return raw markdown
  if (sourceParam) {
    const chunks = rows.map((r) => r.content as string)
    const content = chunks.join('\n\n')
    const filename = (sourceParam.split('/').pop() ?? 'document') + '.md'
    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // Bulk export — build ZIP
  // Group chunks by source and join in order
  const docMap = new Map<string, { type: string; title: string; chunks: string[] }>()
  for (const row of rows) {
    const src = row.source as string
    if (!docMap.has(src)) {
      docMap.set(src, { type: row.type as string, title: row.title as string, chunks: [] })
    }
    docMap.get(src)!.chunks.push(row.content as string)
  }

  const files: Record<string, Uint8Array> = {}

  for (const [source, { type, title, chunks }] of docMap) {
    const body = chunks.join('\n\n')
    // Prepend a YAML frontmatter block for non-bio/resume docs
    const frontmatter = type !== 'bio' && type !== 'resume'
      ? `---\ntitle: ${title}\ntype: ${type}\nsource: ${source}\n---\n\n`
      : ''
    const content = frontmatter + body
    const filePath = sourceToFilePath(source, type)
    files[filePath] = strToU8(content)
  }

  // Add a manifest
  const manifest = [
    '# folio-ai export',
    `Exported: ${new Date().toISOString()}`,
    '',
    '## Files',
    ...Object.keys(files).sort().map((f) => `- ${f}`),
  ].join('\n')
  files['README.md'] = strToU8(manifest)

  const zipped = zipSync(files, { level: 6 })
  const date = new Date().toISOString().slice(0, 10)
  const filename = `folio-export-${date}.zip`

  return new Response(zipped, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
