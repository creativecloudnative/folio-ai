import OpenAI from 'openai'

export type ModerationResult =
  | { safe: true }
  | { safe: false; reason: string }

export async function moderateImage(
  buffer: ArrayBuffer,
  contentType: string,
): Promise<ModerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    // If OpenAI isn't configured, fail closed — don't allow unmoderated uploads
    return { safe: false, reason: 'Content moderation is not configured on this server' }
  }

  const openai = new OpenAI()
  const base64 = Buffer.from(buffer).toString('base64')
  const dataUrl = `data:${contentType};base64,${base64}`

  const response = await openai.moderations.create({
    model: 'omni-moderation-latest',
    input: [{ type: 'image_url', image_url: { url: dataUrl } }],
  })

  const result = response.results[0]
  if (!result.flagged) return { safe: true }

  // Surface the highest-confidence flagged category for logging (not shown to user)
  const flagged = Object.entries(result.categories)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  console.warn('[image-moderation] flagged categories:', flagged)

  return {
    safe: false,
    reason: 'This image was flagged by our content moderation system and cannot be used as a profile picture.',
  }
}
