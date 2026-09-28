import { TYPE_IDS, type AreaRecord, type SummaryArea, type TypeId } from '../data/types'
import { heaviestMember } from '../model/area'
import type { ValueWeights } from '../panels/ScenarioBuilder'
import type { MapConfiguration } from '../shared/mapState'
import { TYPE_LABELS } from '../shared/labels'

export const ROLE_OPTIONS = [
  { value: 'municipal_staff', label: 'Municipal staff' },
  { value: 'elected_official', label: 'Elected official' },
  { value: 'community_partner', label: 'Community partner' },
  { value: 'other', label: 'Other planning participant' },
] as const

export const GOAL_OPTIONS = [
  {
    value: 'identify_opportunity',
    label: 'Identify promising housing opportunities',
  },
  { value: 'understand_need', label: 'Understand what housing is missing' },
  { value: 'compare_approaches', label: 'Compare development approaches' },
] as const

export type RoleId = (typeof ROLE_OPTIONS)[number]['value']
export type GoalId = (typeof GOAL_OPTIONS)[number]['value']

export interface PlanningAnswers {
  role: RoleId | ''
  context: string
  goal: GoalId | ''
  /** Municipality or neighborhood `SummaryArea.id` chosen in the wizard. */
  place: string
  /** Selected housing types. The first entry is the type the map opens on. */
  housingTypes: TypeId[]
  /** Balanced defaults. The wizard no longer collects priorities. */
  priorities: ValueWeights
  tradeoff: string
}

export interface PlanningHandoff {
  answers: PlanningAnswers
  configuration: MapConfiguration
  weights: ValueWeights
  summary: string
}

export const DEFAULT_PRIORITIES: ValueWeights = {
  protectResidents: 50,
  lowCarbon: 50,
  climateSafety: 50,
  deepAffordability: 50,
  speedToBuild: 50,
}

export const EMPTY_PLANNING_ANSWERS: PlanningAnswers = {
  role: '',
  context: '',
  goal: '',
  place: '',
  housingTypes: [],
  priorities: DEFAULT_PRIORITIES,
  tradeoff: '',
}

const REQUIRED_BY_STEP: Array<Array<keyof PlanningAnswers>> = [
  ['role'],
  ['goal'],
  ['housingTypes'],
]

export function validatePlanningStep(
  step: number,
  answers: PlanningAnswers,
  _validPlaces: readonly Pick<SummaryArea, 'id'>[] = [],
): string[] {
  const errors: string[] = []
  const required = REQUIRED_BY_STEP[step] ?? []

  for (const field of required) {
    const value = answers[field]
    const missing = Array.isArray(value) ? value.length === 0 : !value
    if (missing) errors.push('Choose an option before continuing.')
  }

  return [...new Set(errors)]
}

function firstLoadedTract(
  areasById: ReadonlyMap<string, AreaRecord>,
): AreaRecord | undefined {
  return areasById.values().next().value
}

/**
 * Turns wizard answers into a shareable map configuration. Place is chosen on
 * the map. If a saved summary id is still present, the map opens on that
 * area's heaviest tract; otherwise it opens on the first loaded tract.
 */
export function createPlanningHandoff(
  answers: PlanningAnswers,
  summaries: readonly SummaryArea[],
  areasById: ReadonlyMap<string, AreaRecord>,
): PlanningHandoff {
  const leadType = answers.housingTypes[0]
  if (!answers.role || !answers.goal || !leadType) {
    throw new Error('Planning answers are incomplete.')
  }

  const summary = summaries.find((candidate) => candidate.id === answers.place)
  const tract = summary
    ? heaviestMember(summary, areasById)
    : firstLoadedTract(areasById)
  if (!tract) {
    throw new Error(
      summary
        ? `No loaded tract belongs to ${summary.label}.`
        : 'No loaded tract is available to open the map.',
    )
  }

  const goal = GOAL_OPTIONS.find((option) => option.value === answers.goal)
  const placePhrase = summary
    ? ` in ${summary.label}, starting from ${tract.name}`
    : `, starting from ${tract.name}. Choose a municipality or neighborhood on the map`

  return {
    answers,
    configuration: {
      place: tract.id,
      type: leadType,
      view: answers.goal === 'understand_need' ? 'need' : 'match',
      dimension: '2d',
    },
    weights: { ...DEFAULT_PRIORITIES },
    summary: `${goal?.label ?? 'Planning'} for ${describeHousingTypes(answers.housingTypes)}${placePhrase}.`
  }
}

export function describeHousingTypes(types: readonly TypeId[]): string {
  const labels = types.map((type) => TYPE_LABELS[type])
  if (labels.length <= 1) return labels[0] ?? 'a housing type'
  return `${labels.join(', ')}. The map starts on ${labels[0]}`
}

/** Reads current answers and older saved answers that stored one housing type. */
export function normalizePlanningAnswers(value: unknown): PlanningAnswers {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<PlanningAnswers> & {
    housingType?: TypeId | ''
  }
  const fromList = Array.isArray(raw.housingTypes)
    ? raw.housingTypes.filter((type): type is TypeId => TYPE_IDS.includes(type))
    : []
  const legacy =
    raw.housingType && TYPE_IDS.includes(raw.housingType) ? [raw.housingType] : []

  return {
    role: raw.role ?? '',
    context: raw.context ?? '',
    goal: raw.goal ?? '',
    place: raw.place ?? '',
    housingTypes: fromList.length > 0 ? fromList : legacy,
    priorities: { ...DEFAULT_PRIORITIES },
    tradeoff: raw.tradeoff ?? '',
  }
}
