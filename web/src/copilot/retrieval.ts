import {
  COPILOT_KNOWLEDGE,
  type KnowledgeSnippet,
} from './knowledge'

export interface RetrievedSnippet {
  snippet: KnowledgeSnippet
  score: number
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'also',
  'and',
  'are',
  'can',
  'could',
  'does',
  'for',
  'from',
  'have',
  'here',
  'how',
  'into',
  'should',
  'that',
  'the',
  'their',
  'this',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
])

const TOKEN_ALIASES: Readonly<Record<string, string>> = {
  accurate: 'accuracy',
  building: 'build',
  climate: 'hazard',
  floods: 'flood',
  flooded: 'flood',
  houses: 'homes',
  methodology: 'method',
  mines: 'mine',
  parcels: 'parcel',
  permits: 'permit',
  planning: 'planner',
  recommendations: 'recommendation',
  risks: 'risk',
  steps: 'step',
  validate: 'verify',
  verification: 'verify',
  zoning: 'zone',
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map((token) => TOKEN_ALIASES[token] ?? token)
}

function searchableTokens(snippet: KnowledgeSnippet): {
  body: Set<string>
  keywords: Set<string>
} {
  return {
    body: new Set(tokenize(`${snippet.title} ${snippet.text}`)),
    keywords: new Set(tokenize(snippet.keywords.join(' '))),
  }
}

export function retrieveKnowledge(
  query: string,
  limit = 3,
  corpus: readonly KnowledgeSnippet[] = COPILOT_KNOWLEDGE,
): RetrievedSnippet[] {
  const queryTokens = [...new Set(tokenize(query))]

  if (queryTokens.length === 0 || limit <= 0) {
    return []
  }

  return corpus
    .map((snippet, index) => {
      const tokens = searchableTokens(snippet)
      const score = queryTokens.reduce((total, token) => {
        if (tokens.keywords.has(token)) return total + 4
        if (tokens.body.has(token)) return total + 1
        return total
      }, 0)

      return { snippet, score, index }
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ snippet, score }) => ({ snippet, score }))
}
