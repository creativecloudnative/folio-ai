import Anthropic from '@anthropic-ai/sdk'
import { getComposition, getCompositionItems } from './compositions'
import { ingestDocument } from './ingest'
import { sql } from './db'

const anthropic = new Anthropic()

async function compileWithAI(
  compositionType: string,
  title: string,
  items: Array<{ section_label: string; content: string }>,
): Promise<string> {
  const itemsBlock = items
    .map((it, i) =>
      `### Item ${i + 1} — Section: "${it.section_label}"\n\`\`\`\n${it.content.trim()}\n\`\`\``,
    )
    .join('\n\n')

  const systemPrompt = compositionType === 'case-study'
    ? `You are a technical writer composing a polished case study page in Markdown.
Tell a clear story: problem, constraints, options considered, the decision, the architecture (Mermaid diagrams inline), and the outcome.
Use the provided documents as raw material — weave them into a single coherent document.
Preserve all Mermaid diagram code blocks exactly as-is. Use ## for sections.`
    : `You are a technical writer composing a polished technical document in Markdown.
Explain the subject clearly: goals, design decisions, components, and how they interact.
Mermaid diagrams should be preserved inline exactly as-is. Use ## for sections.`

  const userPrompt = `Compile the following source documents into a single polished page titled "${title}".

${itemsBlock}

Output only the final Markdown. Do not include a top-level # heading — that will be added. Start with a concise intro paragraph.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  return `# ${title}\n\n${text.trim()}`
}

export async function publishCompositionById(
  compositionId: string,
  ownerId: string,
): Promise<{ source: string }> {
  const composition = await getComposition(compositionId, ownerId)
  if (!composition) throw new Error('Composition not found')

  const items = await getCompositionItems(compositionId)
  if (items.length === 0) throw new Error('Composition is empty — add documents before publishing')

  // Resolve content for each item (document or nested composition)
  const itemsWithContent = await Promise.all(
    items.map(async (item) => {
      let content = ''

      if (item.document_source) {
        const rows = await sql`
          SELECT content FROM documents
          WHERE owner_id = ${ownerId} AND source = ${item.document_source}
          ORDER BY created_at ASC
        `
        content = (rows as Array<{ content: string }>).map((r) => r.content).join('\n\n')
      } else if (item.ref_composition_id) {
        // Embed the compiled markdown of the referenced composition
        const refComp = await getComposition(item.ref_composition_id, ownerId)
        if (refComp) {
          const refSource = `content/${refComp.type === 'case-study' ? 'case-studies' : refComp.type}/${refComp.slug}.md`
          const rows = await sql`
            SELECT content FROM documents
            WHERE owner_id = ${ownerId} AND source = ${refSource}
            ORDER BY created_at ASC
          `
          content = rows.length > 0
            ? (rows as Array<{ content: string }>).map((r) => r.content).join('\n\n')
            : `[Referenced composition "${refComp.title}" has not been published yet]`
        }
      }

      return { section_label: item.section_label, content }
    }),
  )

  const typeSlug = composition.type
  const typeFolder = typeSlug === 'case-study' ? 'case-studies' : typeSlug
  const source = `content/${typeFolder}/${composition.slug}.md`

  const markdown = await compileWithAI(typeSlug, composition.title, itemsWithContent)

  await ingestDocument(
    typeSlug as Parameters<typeof ingestDocument>[0],
    composition.title,
    source,
    markdown,
    ownerId,
    ownerId,
    { published: true, composition_id: compositionId },
  )

  await sql`UPDATE compositions SET published = TRUE, updated_at = NOW() WHERE id = ${compositionId}`

  return { source }
}
