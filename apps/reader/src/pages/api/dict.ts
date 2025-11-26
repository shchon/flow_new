import type { NextApiRequest, NextApiResponse } from 'next'

interface DictResponse {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
    }>
  }>
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { word } = req.query

  if (!word || Array.isArray(word)) {
    res.status(400).json({ error: 'Missing word parameter' })
    return
  }

  try {
    // Use Free Dictionary API
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word,
      )}`,
    )

    if (!response.ok) {
      // Fallback: return a simple response
      res.status(200).json({
        word,
        meanings: [
          {
            partOfSpeech: 'unknown',
            definitions: [
              {
                definition: 'Definition not found. Please check spelling.',
              },
            ],
          },
        ],
      })
      return
    }

    const data = await response.json()
    const entry = data[0]

    const result: DictResponse = {
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
      meanings: entry.meanings.map((m: any) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions.slice(0, 3).map((d: any) => ({
          definition: d.definition,
          example: d.example,
        })),
      })),
    }

    res.status(200).json(result)
  } catch (error) {
    console.error('Dictionary API error:', error)
    res.status(500).json({ error: 'Failed to fetch dictionary data' })
  }
}
