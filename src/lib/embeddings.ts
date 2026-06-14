import { VoyageAIClient } from 'voyageai'

export const EMBEDDING_MODEL = 'voyage-3-lite'
export const EMBEDDING_DIMS = 512

function getClient() {
  if (!process.env.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY is not set')
  return new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
}

export async function embed(text: string): Promise<number[]> {
  const result = await getClient().embed({ input: [text], model: EMBEDDING_MODEL })
  return result.data![0].embedding!
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const result = await getClient().embed({ input: texts, model: EMBEDDING_MODEL })
  return result.data!.map((d) => d.embedding!)
}
