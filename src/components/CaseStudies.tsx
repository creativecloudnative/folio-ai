import Link from 'next/link'
import { sql } from '@/lib/db'

type Study = {
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

async function fetchPublishedStudies(): Promise<Study[]> {
  const ownerId = process.env.OWNER_ID ?? 'default'
  try {
    const rows = await sql`
      SELECT DISTINCT ON (source) title, source, content
      FROM documents
      WHERE owner_id = ${ownerId}
        AND type = 'case-study'
        AND metadata->>'published' = 'true'
      ORDER BY source, created_at ASC
    `
    return rows.map((row) => ({
      title: row.title as string,
      slug: (row.source as string)
        .replace('content/case-studies/', '')
        .replace('.md', ''),
      excerpt: extractExcerpt(row.content as string),
    }))
  } catch {
    return []
  }
}

const PLACEHOLDER_STUDIES = [
  {
    tag: 'Container Platform',
    title: 'AI-Ready Container Platform at Scale',
    description:
      'Designed a multi-tenant Kubernetes platform supporting 200+ engineering teams — built with GPU node pools and workload isolation patterns applicable to ML inference workloads.',
    badges: ['Kubernetes', 'Multi-tenant', 'GPU', 'Platform Engineering'],
  },
  {
    tag: 'Cloud-Native Architecture',
    title: 'Multi-Cluster GitOps Pipeline',
    description:
      'Architected a GitOps-driven deployment system across 3 cloud regions, reducing deployment lead time by 70% and establishing the foundation for MLOps pipelines.',
    badges: ['GitOps', 'ArgoCD', 'Multi-cluster', 'MLOps'],
  },
  {
    tag: 'Observability',
    title: 'Observability Stack for Distributed Systems',
    description:
      'Built a unified metrics, logging, and tracing platform across hybrid infrastructure — patterns directly applicable to AI inference monitoring and LLM observability.',
    badges: ['OpenTelemetry', 'Prometheus', 'LLM Monitoring'],
  },
  {
    tag: 'AI Architecture',
    title: 'Agentic RAG Pipeline on Kubernetes',
    description:
      'Greenfield architecture design: a production-grade RAG system with autoscaling inference, a vector store tier, and an agentic retrieval loop.',
    badges: ['RAG', 'Vector Store', 'LLM Inference', 'Greenfield'],
  },
]

export default async function CaseStudies() {
  const published = await fetchPublishedStudies()
  const hasPublished = published.length > 0

  return (
    <section id="work" className="py-24 border-t border-slate-800/60">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-sm font-mono text-indigo-400 mb-3 tracking-widest uppercase">
          Architecture Work
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Case Studies</h2>
        <p className="text-slate-400 max-w-xl mb-12">
          Real systems design problems, the constraints that shaped them, and the decisions that
          mattered.
        </p>

        {hasPublished ? (
          <div className="grid md:grid-cols-2 gap-6">
            {published.map((s) => (
              <Link
                key={s.slug}
                href={`/case-studies/${s.slug}`}
                className="group relative rounded-xl border border-slate-800 bg-slate-900/50 hover:border-indigo-800 hover:bg-slate-900/80 p-6 flex flex-col gap-4 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-indigo-400 tracking-wide">
                    Architecture
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white leading-snug">{s.title}</h3>
                {s.excerpt && (
                  <p className="text-sm text-slate-400 leading-relaxed flex-1">{s.excerpt}</p>
                )}
                <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  Read case study →
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {PLACEHOLDER_STUDIES.map((s) => (
              <div
                key={s.title}
                className="group relative rounded-xl border border-slate-800 bg-slate-900/30 opacity-60 p-6 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-indigo-400 tracking-wide">{s.tag}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-500">
                    Coming soon
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white leading-snug">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed flex-1">{s.description}</p>
                <div className="flex flex-wrap gap-2">
                  {s.badges.map((b) => (
                    <span
                      key={b}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
