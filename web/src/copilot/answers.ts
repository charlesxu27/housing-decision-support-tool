import type { HexRecord, MatchStatus, TypeId } from '../data/types'
import { retrieveKnowledge } from './retrieval'

export interface CopilotCitation {
  id: string
  label: string
}

export interface AnswerSection {
  heading: string
  text: string
  citationIds: readonly string[]
}

export interface GroundedAnswer {
  status: 'answer' | 'no-result'
  title: string
  sections: readonly AnswerSection[]
  citations: readonly CopilotCitation[]
  sourceCheckLabel: string
}

export interface BuildAnswerInput {
  query: string
  selectedHex: HexRecord
  selectedType: TypeId
  matchStatus?: MatchStatus
}

const TYPE_LABELS: Record<TypeId, string> = {
  adu: 'ADU',
  duplex_triplex: 'duplex or triplex',
  townhome: 'townhome',
  small_apartment: 'small apartment',
  large_apartment: 'large apartment',
  senior_accessible: 'senior-accessible housing',
  rehab_reuse: 'rehabilitation or reuse',
  detached_sf: 'detached single-family housing',
}

const DISPLAY_LABELS: Readonly<Record<string, string>> = {
  by_right: 'by right',
  special_exception: 'special exception',
  conditional_use: 'conditional use',
  not_permitted: 'not permitted',
  unknown: 'unknown',
  not_recommended: 'not recommended',
  low_priority: 'low priority',
  needed_but_hard: 'needed but hard',
  ready_match: 'ready match',
  needs_approval: 'needs approval',
  blocked_by_zoning: 'blocked by zoning',
  zoning_unknown: 'zoning unknown',
  insufficient_data: 'insufficient data',
}

function display(value: string): string {
  return DISPLAY_LABELS[value] ?? value
}

export function buildGroundedAnswer({
  query,
  selectedHex,
  selectedType,
  matchStatus,
}: BuildAnswerInput): GroundedAnswer {
  const retrieved = retrieveKnowledge(query)

  if (retrieved.length === 0) {
    return {
      status: 'no-result',
      title: 'No grounded answer found',
      sections: [
        {
          heading: 'Try a planning topic',
          text:
            'This local preview could not connect that question to its small knowledge corpus. Ask about the fixture data, Need · Fit · Allowed, zoning, hazards, or human review.',
          citationIds: [],
        },
      ],
      citations: [],
      sourceCheckLabel: 'No matching local source',
    }
  }

  const place =
    selectedHex.neighborhood ?? `${selectedHex.muni} planning area`
  const fit = selectedHex.fit[selectedType]
  const selectedCitation: CopilotCitation = {
    id: 'selected-fixture',
    label: `Selected fixture: ${place} (${selectedHex.h3})`,
  }
  const selectedFacts = [
    `${TYPE_LABELS[selectedType]} is shown with ${display(selectedHex.need[selectedType])} need`,
    `${display(fit.band)} fit across ${fit.parcels} illustrative parcels`,
    `an illustrative range of ${fit.homes[0]}–${fit.homes[1]} homes`,
    `and zoning marked ${display(selectedHex.allowed[selectedType])}`,
  ]

  if (matchStatus) {
    selectedFacts.push(`The current match status is ${display(matchStatus)}`)
  }

  const knowledgeCitations = retrieved.map(({ snippet }) => ({
    id: snippet.id,
    label: snippet.label,
  }))
  const knowledgeSections = retrieved.map(({ snippet }) => ({
    heading: snippet.title,
    text: snippet.text,
    citationIds: [snippet.id],
  }))

  return {
    status: 'answer',
    title: `Grounded notes for ${place}`,
    sections: [
      {
        heading: 'Selected map context',
        text: `${selectedFacts.join(', ')}. These are fixture values, not verified findings.`,
        citationIds: [selectedCitation.id],
      },
      ...knowledgeSections,
    ],
    citations: [selectedCitation, ...knowledgeCitations],
    sourceCheckLabel: `${knowledgeCitations.length + 1} labeled sources`,
  }
}
