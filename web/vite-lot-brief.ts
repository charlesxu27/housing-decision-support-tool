import type { IncomingMessage, ServerResponse } from 'node:http'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    demand: { type: 'string' },
    transit: { type: 'string' },
    equity: { type: 'string' },
    climate: { type: 'string' },
    cost: { type: 'string' },
    size: { type: 'string' },
    sources_note: { type: 'string' },
  },
  required: [
    'headline',
    'summary',
    'demand',
    'transit',
    'equity',
    'climate',
    'cost',
    'size',
    'sources_note',
  ],
} as const

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

  let card: { pin?: string; types?: unknown[] }
  try {
    card = JSON.parse(await readBody(req)) as { pin?: string; types?: unknown[] }
    if (!card?.pin || !card.types?.length) throw new Error('invalid card')
  } catch {
    send(res, 400, { error: 'invalid lot brief card' })
    return
  }

  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    send(res, 200, { engine: 'template' })
    return
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
        temperature: 0.3,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'lot_brief',
            strict: true,
            schema: SCHEMA,
          },
        },
        messages: [
          {
            role: 'system',
            content:
              'Write a briefing for City of Pittsburgh / municipal housing staff. Use ONLY the JSON snapshot facts. Do not invent scores, zoning sections, stop names, unit counts, or dollar figures. If a field is null, say it is unknown. Do not re-rank housing types; quote selectedStatus and the types table as given. Keep each section to 2–4 sentences. headline <= 110 characters. Transit must use transitTrips800m as a tract-centroid measure, not a named nearest stop unless the JSON includes a stop name.',
          },
          { role: 'user', content: JSON.stringify(card) },
        ],
      }),
    })
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`)
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('empty model content')
    const narrative = JSON.parse(content) as Record<string, string>
    if (!narrative.headline || !narrative.demand) throw new Error('incomplete narrative')
    send(res, 200, { engine: 'openai', narrative })
  } catch {
    send(res, 200, { engine: 'template' })
  }
}
