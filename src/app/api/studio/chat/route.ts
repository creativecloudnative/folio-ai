import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { buildStudioSystemPrompt } from '@/agent/studio/prompts/system'
import { studioTools } from '@/agent/studio/tools/definitions'
import { executeStudioTool } from '@/agent/studio/tools/handlers'
import { getTokenBalance, consumeTokens } from '@/lib/folios'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'signin_required' }, { status: 401 })
  }

  const ownerId = session.user.id
  const ownerName = session.user.name ?? undefined

  // Check token budget before processing
  const balance = await getTokenBalance(ownerId)
  if (balance.remaining <= 0) {
    return Response.json(
      { error: 'budget_exceeded', budget: balance },
      { status: 402 },
    )
  }

  let body: { messages: Anthropic.MessageParam[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const MAX_HISTORY = 20
  let messages: Anthropic.MessageParam[] = body.messages.slice(-MAX_HISTORY)
  const system = buildStudioSystemPrompt(ownerName)
  const encoder = new TextEncoder()
  let totalTokensUsed = 0

  async function* generateStream() {
    for (let iter = 0; iter < 8; iter++) {
      const stream = anthropic.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system,
        tools: studioTools,
        messages,
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield `data: ${JSON.stringify({ delta: event.delta.text })}\n\n`
        }
      }

      const finalMsg = await stream.finalMessage()
      totalTokensUsed += (finalMsg.usage.input_tokens ?? 0) + (finalMsg.usage.output_tokens ?? 0)

      if (finalMsg.stop_reason === 'end_turn') break

      if (finalMsg.stop_reason === 'tool_use') {
        const toolUses = finalMsg.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        )

        messages = [...messages, { role: 'assistant', content: finalMsg.content }]

        const results: Anthropic.ToolResultBlockParam[] = []
        for (const t of toolUses) {
          const toolLabel =
            t.name === 'save_content'
              ? `Saving "${(t.input as Record<string, unknown>).title}"…`
              : t.name === 'search_content'
                ? `Searching for "${(t.input as Record<string, unknown>).query}"…`
                : t.name === 'list_content'
                  ? 'Listing portfolio content…'
                  : `Running ${t.name}…`
          yield `data: ${JSON.stringify({ tool: toolLabel })}\n\n`

          const result = await executeStudioTool(
            t.name,
            t.input as Record<string, unknown>,
            ownerId,
          )
          results.push({ type: 'tool_result', tool_use_id: t.id, content: result })
        }

        messages = [...messages, { role: 'user', content: results }]
        continue
      }

      break
    }

    // Persist token usage and emit final balance to client
    if (totalTokensUsed > 0) {
      await consumeTokens(ownerId, totalTokensUsed).catch(() => {})
    }
    const updatedBalance = await getTokenBalance(ownerId).catch(() => null)
    if (updatedBalance) {
      yield `data: ${JSON.stringify({ budget: updatedBalance })}\n\n`
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        )
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
