import { notFound } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import CaseStudyContent from '@/components/CaseStudyContent'
import { sql } from '@/lib/db'
import config from '../../../../folio.config'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const ownerId = process.env.OWNER_ID ?? 'default'
  const rows = await sql`
    SELECT title FROM documents
    WHERE owner_id = ${ownerId}
      AND source = ${'content/case-studies/' + slug + '.md'}
      AND metadata->>'published' = 'true'
    LIMIT 1
  `
  if (rows.length === 0) return {}
  return {
    title: `${rows[0].title as string} — ${config.owner.name}`,
    description: `Architecture case study by ${config.owner.name}`,
  }
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params
  const ownerId = process.env.OWNER_ID ?? 'default'
  const source = `content/case-studies/${slug}.md`

  const rows = await sql`
    SELECT title, content
    FROM documents
    WHERE owner_id = ${ownerId}
      AND source = ${source}
      AND metadata->>'published' = 'true'
    ORDER BY created_at ASC
  `

  if (rows.length === 0) notFound()

  const title = rows[0].title as string
  const content = (rows as Array<{ content: string }>).map((r) => r.content).join('\n\n')

  return (
    <>
      <Nav />
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <Link
            href="/#work"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-indigo-400 transition-colors mb-10"
          >
            ← Case Studies
          </Link>

          <CaseStudyContent content={content} title={title} />

          <div className="mt-16 pt-8 border-t border-zinc-800 flex items-center justify-between">
            <Link
              href="/#work"
              className="text-sm text-zinc-500 hover:text-indigo-400 transition-colors"
            >
              ← Back to all case studies
            </Link>
            <a
              href={`mailto:${config.owner.email}`}
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Get in touch
            </a>
          </div>
        </div>
      </main>
    </>
  )
}
