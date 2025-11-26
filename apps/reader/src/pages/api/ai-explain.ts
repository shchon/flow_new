import type { NextApiRequest, NextApiResponse } from 'next'

interface AiConfig {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  prompt?: string
}

interface AiExplainRequestBody {
  word: string
  context?: string
  config: AiConfig
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { word, context, config } = req.body as AiExplainRequestBody

  if (!word || !config?.baseUrl || !config?.apiKey || !config?.model) {
    res.status(400).json({ error: 'Missing word or AI configuration' })
    return
  }

  const promptTemplate =
    config.prompt ||
    'You are an assistant that explains English words in simple Chinese with 1-2 concise example sentences.'

  const prompt = promptTemplate
    .replace(/\{word\}/g, word)
    .replace(/\{context\}/g, context || '')

  const base = config.baseUrl.replace(/\/$/, '')
  const provider = (config.provider || 'openai').toLowerCase()

  // OpenAI-compatible chat completions URL
  // - OpenAI:       https://api.openai.com + /v1/chat/completions
  // - DeepSeek:     https://api.deepseek.com + /chat/completions
  // - Custom proxy: user can provide full path in baseUrl
  let url: string
  if (provider === 'deepseek') {
    url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
  } else if (base.endsWith('/chat/completions')) {
    url = base
  } else {
    url = `${base}/v1/chat/completions`
  }

  try {
    const requestBody = {
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content:
            context && context !== word
              ? `Here is a word and its context.
Word: "${word}"
Context: "${context}".
Please explain this word in Chinese, including meaning and 1-2 short example sentences.`
              : `Please explain the word "${word}" in Chinese, including its meaning and 1-2 example sentences.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const text = await response.text()
      res.status(response.status).json({ error: `API Error: ${text}` })
      return
    }

    const data = await response.json()
    const explanation =
      data.choices?.[0]?.message?.content || 'No explanation returned.'

    res.status(200).json({ explanation })
  } catch (error) {
    res.status(500).json({
      error: `Failed to call AI service: ${
        error instanceof Error ? error.message : String(error)
      }`,
    })
  }
}
