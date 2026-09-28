import type { IncomingMessage, ServerResponse } from 'node:http'
import { isLotBriefCard, rewriteLotBrief } from './src/model/lotBriefRewrite.ts'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function handleLotBriefRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: Record<string, string>,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'POST only' })
    return
  }

  let card: unknown
  try {
    card = JSON.parse(await readBody(req))
  } catch {
    send(res, 400, { error: 'invalid lot brief card' })
    return
  }
  if (!isLotBriefCard(card)) {
    send(res, 400, { error: 'invalid lot brief card' })
    return
  }

  send(res, 200, await rewriteLotBrief(card, env))
}
