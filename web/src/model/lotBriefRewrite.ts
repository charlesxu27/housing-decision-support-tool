/** Cheapest current OpenAI chat model that supports strict JSON output. */
export const DEFAULT_LOT_BRIEF_MODEL = 'gpt-5-nano'

const FIELDS = [
  'headline',
  'summary',
  'demand',
  'transit',
  'equity',
  'climate',
  'cost',
  'size',
  'sources_note',
] as const

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(FIELDS.map((field) => [field, { type: 'string' }])),
  required: [...FIELDS],
}

const INSTRUCTIONS =
  'Write a briefing for City of Pittsburgh / municipal housing staff. Use ONLY the JSON snapshot facts. Do not invent scores, zoning sections, stop names, unit counts, or dollar figures. If a field is null, say it is unknown. Do not re-rank housing types; describe selectedStatus and the types table as given. Keep each section to 2–4 sentences. headline <= 110 characters. Transit must use transitTrips800m as a tract-centroid measure, not a named nearest stop unless the JSON includes a stop name. Use plain sentences. Do not print raw JSON keys or enum codes such as needed_but_hard, hh12, sf_detached, or transitTrips800m. Say “needed but hard,” and use selectedTypeLabel for the housing type.'

export interface LotBriefRewriteEnv {
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
}

export interface LotBriefRewriteResult {
  engine: 'openai' | 'template'
  model?: string
  narrative?: Record<(typeof FIELDS)[number], string>
}

export function isLotBriefCard(card: unknown): boolean {
  if (!card || typeof card !== 'object') return false
  const record = card as { pin?: unknown; types?: unknown }
  return typeof record.pin === 'string' && record.pin.length > 0 && Array.isArray(record.types) && record.types.length > 0
}

function narrativeFrom(content: string): LotBriefRewriteResult['narrative'] | null {
  const parsed = JSON.parse(content) as Record<string, unknown>
  const narrative = {} as NonNullable<LotBriefRewriteResult['narrative']>
  for (const field of FIELDS) {
    const value = parsed[field]
    if (typeof value !== 'string' || value.trim() === '') return null
    narrative[field] = value
  }
  return narrative
}

async function complete(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

/**
 * Asks OpenAI to rephrase one already-computed lot card.
 * Returns the snapshot-template signal when the key is missing or the model fails,
 * so the page can keep the deterministic brief.
 */
export async function rewriteLotBrief(
  card: unknown,
  env: LotBriefRewriteEnv,
): Promise<LotBriefRewriteResult> {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey || !isLotBriefCard(card)) return { engine: 'template' }

  const model = env.OPENAI_MODEL?.trim() || DEFAULT_LOT_BRIEF_MODEL
  const body: Record<string, unknown> = {
    model,
    max_completion_tokens: 800,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'lot_brief', strict: true, schema: SCHEMA },
    },
    messages: [
      { role: 'system', content: INSTRUCTIONS },
      { role: 'user', content: JSON.stringify(card) },
    ],
  }
  if (model.startsWith('gpt-5')) body.reasoning_effort = 'minimal'

  try {
    let response = await complete(apiKey, body)
    if (!response.ok && response.status === 400 && 'reasoning_effort' in body) {
      delete body.reasoning_effort
      response = await complete(apiKey, body)
    }
    if (!response.ok) return { engine: 'template' }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return { engine: 'template' }
    const narrative = narrativeFrom(content)
    if (!narrative) return { engine: 'template' }
    return { engine: 'openai', model, narrative }
  } catch {
    return { engine: 'template' }
  }
}
