import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { word } = req.query

  if (!word || Array.isArray(word)) {
    res.status(400).send('Missing word')
    return
  }

  const targetUrl = `https://m.youdao.com/m/result?word=${encodeURIComponent(
    word,
  )}&lang=en`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://m.youdao.com/',
      },
    })

    if (!response.ok) {
      res.status(response.status).send(`Failed: ${response.statusText}`)
      return
    }

    const html = await response.text()

    // Set CORS headers to allow iframe embedding
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Frame-Options', 'ALLOWALL')
    res.status(200).send(html)
  } catch (error) {
    console.error('Youdao proxy error:', error)
    res.status(500).send('Failed to fetch dictionary content')
  }
}
