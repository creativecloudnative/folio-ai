import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { getFolioBySlug } from '@/lib/folios'
import { buildSystemPrompt } from '@/agent/prompts/system'
import { tools } from '@/agent/tools/definitions'
import { executeTool } from '@/agent/tools/handlers'
import { retrieveRelevant, fetchMemoriesForVisitor, fetchBaselineResume, fetchConnectionForVisitor, formatChunksForPrompt } from '@/lib/rag'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic()

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

function toolStatusLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'analyze_job_fit': {
      const title = input.job_title as string | undefined
      const company = input.company as string | undefined
      if (title && company) return `Analyzing fit for ${title} at ${company}…`
      if (title) return `Analyzing fit for ${title}…`
      return 'Analyzing job fit…'
    }
    case 'schedule_meeting': return 'Generating booking link…'
    case 'send_note':       return 'Sending note…'
    case 'take_note':       return 'Saving note…'
    default:                return `Running ${name}…`
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return Response.json({ error: 'rate_limit_exceeded' }, { status: 429 })
  }

  const folio = await getFolioBySlug(slug)
  if (!folio) {
    return Response.json({ error: 'folio_not_found' }, { status: 404 })
  }

  const session = await auth()

  let body: { messages: Anthropic.MessageParam[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const MAX_HISTORY = 10
  let messages: Anthropic.MessageParam[] = body.messages.slice(-MAX_HISTORY)

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  const query = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : null

  const ownerId = folio.owner_id

  const [chunks, memories, baseline, connection] = await Promise.all([
    query ? retrieveRelevant(query, ownerId) : Promise.resolve([]),
    fetchMemoriesForVisitor(session?.user?.email ?? null, null, ownerId),
    fetchBaselineResume(ownerId),
    fetchConnectionForVisitor(session?.user?.email ?? null, ownerId),
  ])

  const relevantContext = formatChunksForPrompt(chunks)
  const visitorMemories = formatChunksForPrompt(memories)
  const baselineResume = formatChunksForPrompt(baseline) || undefined

  let visitorConnection: string | undefined
  if (connection?.content) {
    const meta = connection.metadata ?? {}
    const visitCount = meta.visit_count as number | undefined
    const lastSeen = meta.last_seen as string | undefined
    const historyParts: string[] = []
    if (visitCount !== undefined) historyParts.push(`${visitCount} visit${visitCount !== 1 ? 's' : ''}`)
    if (lastSeen) {
      const d = new Date(lastSeen).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      historyParts.push(`last seen ${d}`)
    }
    visitorConnection = historyParts.length > 0
      ? `${connection.content}\n\n**Visit history**: ${historyParts.join(', ')}`
      : connection.content
  }

  const system = buildSystemPrompt(
    session?.user?.name,
    relevantContext,
    visitorMemories || undefined,
    baselineResume,
    visitorConnection,
  )

  const encoder = new TextEncoder()

  async function* generateStream() {
    for (let iter = 0; iter < 5; iter++) {
      const stream = anthropic.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system,
        tools,
        messages,
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield `data: ${JSON.stringify({ delta: event.delta.text })}\n\n`
        }
      }

      const finalMsg = await stream.finalMessage()
      if (finalMsg.stop_reason === 'end_turn') break

      if (finalMsg.stop_reason === 'tool_use') {
        const toolUses = finalMsg.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        )

        messages = [...messages, { role: 'assistant', content: finalMsg.content }]

        const results: Anthropic.ToolResultBlockParam[] = []
        for (const t of toolUses) {
          const label = toolStatusLabel(t.name, t.input as Record<string, unknown>)
          yield `data: ${JSON.stringify({ tool: label })}\n\n`

          const result = await executeTool(
            t.name,
            t.input as Record<string, unknown>,
            session,
          )
          results.push({ type: 'tool_result', tool_use_id: t.id, content: result })
        }

        yield `data: ${JSON.stringify({ tool: null })}\n\n`
        messages = [...messages, { role: 'user', content: results }]
        continue
      }

      break
    }

    yield 'data: [DONE]\n\n'
  }

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generateStream()) {
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
