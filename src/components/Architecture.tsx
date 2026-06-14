import Link from 'next/link'
import { sql } from '@/lib/db'

type Design = {
  title: string
  slug: string
  excerpt: string
}

function extractExcerpt(content: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && !trimmed.startsWith('```')) {
      return trimmed.length > 220 ? trimmed.slice(0, 217) + '…' : trimmed
    }
  }
  return ''
}

async function fetchPublishedDesigns(): Promise<Design[]> {
  const ownerId = process.env.OWNER_ID ?? 'default'
  try {
    const rows = await sql`
      SELECT DISTINCT ON (source) title, source, content
      FROM documents
      WHERE owner_id = ${ownerId}
        AND type = 'architecture'
        AND metadata->>'published' = 'true'
      ORDER BY source, created_at ASC
    `
    return rows.map((row) => ({
      title: row.title as string,
      slug: (row.source as string)
        .replace('content/architecture/', '')
        .replace('.md', ''),
      excerpt: extractExcerpt(row.content as string),
    }))
  } catch {
    return []
  }
}

export default async function Architecture() {
  const designs = await fetchPublishedDesigns()
  if (designs.length === 0) return null

  return (
    <section id="architecture" className="py-24 border-t border-slate-800/60">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-sm font-mono text-indigo-400 mb-3 tracking-widest uppercase">
          Reference Designs
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Architecture</h2>
        <p className="text-slate-400 max-w-xl mb-12">
          Standalone patterns and reference architectures — conceptual designs for classes of
          problems, independent of any single engagement.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {designs.map((d) => (
            <Link
              key={d.slug}
              href={`/architecture/${d.slug}`}
              className="group relative rounded-xl border border-slate-800 bg-slate-900/50 hover:border-indigo-800 hover:bg-slate-900/80 p-6 flex flex-col gap-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-indigo-400 tracking-wide">
                  Reference Architecture
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white leading-snug">{d.title}</h3>
              {d.excerpt && (
                <p className="text-sm text-slate-400 leading-relaxed flex-1">{d.excerpt}</p>
              )}
              <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">
                View architecture →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
