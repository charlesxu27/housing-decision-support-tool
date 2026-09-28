import type { AreaRecord, MatchStatus, TypeId } from '../data/types'
import { areaPlace } from '../model/area'
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
  selectedArea: AreaRecord
  selectedType: TypeId
  matchStatus?: MatchStatus
  /** True when the Pittsburgh zoning matrix has not been human-verified. */
  zoningDraft?: boolean
}

const TYPE_LABELS: Record<TypeId, string> = {
  adu: 'ADU',
  duplex_triplex: 'duplex or triplex',
  townhome: 'townhome',
  small_apartment: 'small apartment',
  large_apartment: 'large apartment',
  senior_accessible: 'senior-accessible housing',
  rehab_reuse: 'renovate or reuse',
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

function pct(value: number | null): string {
  return value == null ? 'not available' : `${Math.round(value * 100)}%`
}

export function buildGroundedAnswer({
  query,
  selectedArea,
  selectedType,
  matchStatus,
  zoningDraft = false,
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
            'This local preview could not connect that question to its small knowledge corpus. Ask about the data sources, Need · Fit · Allowed, zoning, hazards, coverage limits, or human review.',
          citationIds: [],
        },
      ],
      citations: [],
      sourceCheckLabel: 'No matching local source',
    }
  }

  const place = `${selectedArea.name}, ${areaPlace(selectedArea)}`
  const fit = selectedArea.fit[selectedType]
  const allowed = selectedArea.allowed[selectedType]
  const selectedCitation: CopilotCitation = {
    id: 'selected-tract',
    label: `Selected tract: ${place} (GEOID ${selectedArea.id})`,
  }
  const zoningNote = !selectedArea.inCity
    ? 'zoning unknown because the tract is outside the City of Pittsburgh'
    : zoningDraft
      ? `zoning marked ${display(allowed)} from the draft, not human-verified, Pittsburgh matrix`
      : `zoning marked ${display(allowed)}`
  const selectedFacts = [
    `${TYPE_LABELS[selectedType]} shows ${display(selectedArea.need[selectedType])} need`,
    `${display(fit.band)} fit across ${fit.parcels} suitable parcels`,
    `a modeled range of ${fit.homes[0]}–${fit.homes[1]} homes`,
    zoningNote,
  ]

  if (matchStatus) {
    selectedFacts.push(`the current match status is ${display(matchStatus)}`)
  }

  const hazardFacts = [
    `${selectedArea.transitTrips800m.toLocaleString()} weekday transit trips within 800 m`,
    `flood zone share ${pct(selectedArea.risk.floodShare)}`,
    selectedArea.risk.floodway
      ? 'mostly regulatory floodway'
      : `floodway share ${pct(selectedArea.risk.floodwayShare)}`,
    `steep slopes ${pct(selectedArea.risk.slopeShare)}`,
    `undermined land ${pct(selectedArea.risk.undermined)}`,
    `displacement index ${pct(selectedArea.risk.displacement)}`,
  ]

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
        heading: 'Selected tract context',
        text: `${selectedFacts.join(', ')}. Transit and hazards: ${hazardFacts.join(', ')}. Values marked not available were not published by the source.`,
        citationIds: [selectedCitation.id],
      },
      ...knowledgeSections,
    ],
    citations: [selectedCitation, ...knowledgeCitations],
    sourceCheckLabel: `${knowledgeCitations.length + 1} labeled sources`,
  }
}
