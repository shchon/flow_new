import type { NextApiRequest, NextApiResponse } from 'next'

interface WebDavPayload {
  action: 'upload' | 'download'
  url: string
  username?: string
  password?: string
  vocabulary?: any
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { action, url, username, password, vocabulary } = req.body as WebDavPayload

  if (!action || !url) {
    res.status(400).json({ error: 'Missing action or url' })
    return
  }

  const headers: Record<string, string> = {}
  if (username || password) {
    const token = Buffer.from(`${username || ''}:${password || ''}`).toString('base64')
    headers['Authorization'] = `Basic ${token}`
  }

  try {
    if (action === 'upload') {
      headers['Content-Type'] = 'application/json'
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ vocabulary }),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        res
          .status(response.status)
          .json({ error: `Upload failed: HTTP ${response.status} ${response.statusText} ${text}` })
        return
      }
      res.status(200).json({ ok: true })
      return
    }

    if (action === 'download') {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        res
          .status(response.status)
          .json({ error: `Download failed: HTTP ${response.status} ${response.statusText} ${text}` })
        return
      }
      const data = await response.json().catch(async () => {
        const text = await response.text()
        try {
          return JSON.parse(text)
        } catch {
          return text
        }
      })
      res.status(200).json({ data })
      return
    }

    res.status(400).json({ error: 'Invalid action' })
  } catch (error) {
    res.status(500).json({
      error: `WebDAV request failed: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
}
