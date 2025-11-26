import type { NextApiRequest, NextApiResponse } from 'next'

interface AiConfig {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  prompt?: string
}

interface ReadingQuizRequestBody {
  context: string
  questionCount: number
  config: AiConfig
}

interface QuizQuestion {
  question: string
  options: string[]
  answerIndex: number
  explanation?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { context, questionCount, config } = req.body as ReadingQuizRequestBody

  if (!context || !config?.baseUrl || !config?.apiKey || !config?.model) {
    res
      .status(400)
      .json({ error: 'Missing reading context or AI configuration' })
    return
  }

  const count = [3, 5, 10].includes(questionCount) ? questionCount : 5

  const base = config.baseUrl.replace(/\/$/, '')
  const provider = (config.provider || 'openai').toLowerCase()

  // Simple heuristic: if there are Chinese characters in the context,
  // treat it as a Chinese passage; otherwise as English.
  const hasChinese = /[\u4e00-\u9fff]/.test(context)

  let url: string
  if (provider === 'deepseek') {
    url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
  } else if (base.endsWith('/chat/completions')) {
    url = base
  } else {
    url = `${base}/v1/chat/completions`
  }

  const systemPrompt = hasChinese
    ? '你是一名中文阅读理解出题老师。针对一整章或较长篇幅的中文故事文本，生成用于测试对故事内容理解的多项选择题，重点考察情节、关键事件、人物关系和动机、以及合理推断。不要出纯语法或孤立词汇题。只输出合法 JSON。'
    : 'You are an English reading comprehension assistant. Given a story chapter or a long passage, you generate multiple-choice questions that test understanding of the STORY CONTENT: plot, key events, characters, motivations, and inferences. You do NOT focus on grammar drills or isolated vocabulary questions. Respond ONLY with valid JSON.'

  const userPrompt = hasChinese
    ? `阅读下面的中文故事章节（或较长篇幅），根据内容出 ${count} 道**中文**阅读理解单项选择题：

要求：
- 题干和选项都用中文表述。
- 重点考察对故事情节的理解：主要事件、因果关系、人物关系和动机、以及基于文本的合理推断。
- 除非与理解情节密切相关，请避免出纯词汇或语法题。
- 每道题有 4 个选项（A、B、C、D）。
- 每题只有 1 个正确选项。
- 为每题提供一句或几句**中文**解析，说明为什么该选项是正确的。

输出格式：严格按照下面的 TypeScript 类型，以合法 JSON 数组形式输出，不要添加任何多余说明：
[
  {
    "question": string,
    "options": string[], // 恰好 4 个选项
    "answerIndex": number, // 0-3，对应 options 数组的索引
    "explanation": string
  },
  ...
]

待出题的原文：
"""
${context}
"""`
    : `Read the following passage (which represents the current chapter or a large part of it) and create ${count} English multiple-choice questions (MCQs).

Requirements:
- Questions and options must be in English.
- Focus on STORY COMPREHENSION: main events, causes and consequences, character relationships, motivations, and reasonable inferences from the story.
- Avoid pure vocabulary or grammar questions unless they are crucial to understanding the plot.
- Each question must have 4 options (A, B, C, D).
- Only ONE correct answer per question.
- Provide a short English explanation for why the correct answer is right.

Output STRICTLY as valid JSON, with this exact TypeScript type:
[
  {
    "question": string,
    "options": string[], // exactly 4 items
    "answerIndex": number, // 0-3, index in options array
    "explanation": string
  },
  ...
]

Passage:
"""
${context}
"""`

  try {
    const requestBody = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
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
    const content: string =
      data.choices?.[0]?.message?.content || '[]'

    let questions: QuizQuestion[]
    try {
      questions = JSON.parse(content)
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response as JSON.' })
      return
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(500).json({ error: 'AI returned empty or invalid questions.' })
      return
    }

    const sanitized = questions
      .slice(0, count)
      .map((q) => {
        const options = Array.isArray(q.options)
          ? q.options.map((o) => String(o || '').trim()).slice(0, 4)
          : []

        let answerIndex = Number.isInteger(q.answerIndex) ? q.answerIndex : 0
        if (options.length > 0) {
          const maxIndex = options.length - 1
          if (answerIndex < 0) answerIndex = 0
          if (answerIndex > maxIndex) answerIndex = maxIndex
        } else {
          answerIndex = 0
        }

        return {
          question: String(q.question || '').trim(),
          options,
          answerIndex,
          explanation: q.explanation
            ? String(q.explanation).trim()
            : undefined,
        }
      })
      .filter((q) => q.question && q.options.length === 4)

    if (!sanitized.length) {
      res.status(500).json({ error: 'No valid questions after sanitization.' })
      return
    }

    res.status(200).json({ questions: sanitized })
  } catch (error) {
    res.status(500).json({
      error: `Failed to call AI service: ${
        error instanceof Error ? error.message : String(error)
      }`,
    })
  }
}
