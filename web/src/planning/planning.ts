import type { HexRecord, TypeId } from '../data/types'
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
export type PriorityKey = keyof ValueWeights

export interface PlanningAnswers {
  role: RoleId | ''
  context: string
  goal: GoalId | ''
  place: string
  housingType: TypeId | ''
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
  housingType: '',
  priorities: DEFAULT_PRIORITIES,
  tradeoff: '',
}

export const PRIORITY_OPTIONS: Array<{
  key: PriorityKey
  label: string
  explanation: string
}> = [
  {
    key: 'protectResidents',
    label: 'Protect existing residents',
    explanation: 'Raises approaches with lower displacement pressure.',
  },
  {
    key: 'deepAffordability',
    label: 'Deep affordability',
    explanation: 'Raises approaches intended to serve cost-burdened households.',
  },
  {
    key: 'climateSafety',
    label: 'Climate safety',
    explanation: 'Raises approaches with less modeled hazard exposure.',
  },
  {
    key: 'lowCarbon',
    label: 'Low carbon',
    explanation: 'Raises approaches with lower modeled carbon impacts.',
  },
  {
    key: 'speedToBuild',
    label: 'Speed to build',
    explanation: 'Raises approaches with a simpler illustrative delivery path.',
  },
]

const REQUIRED_BY_STEP: Array<Array<keyof PlanningAnswers>> = [
  ['role'],
  ['goal'],
  ['place'],
  ['housingType'],
  ['priorities'],
  [],
]

export function validatePlanningStep(
  step: number,
  answers: PlanningAnswers,
  validPlaces: readonly Pick<HexRecord, 'h3'>[],
): string[] {
  const errors: string[] = []
  const required = REQUIRED_BY_STEP[step] ?? []

  for (const field of required) {
    if (!answers[field]) errors.push(`Choose an option before continuing.`)
  }

  if (step === 2 && !validPlaces.some((place) => place.h3 === answers.place)) {
    errors.push('Choose one of the available illustrative geographies.')
  }

  if (
    step === 4 &&
    Object.values(answers.priorities).some(
      (value) => !Number.isFinite(value) || value < 0 || value > 100,
    )
  ) {
    errors.push('Priority values must be between 0 and 100.')
  }

  return [...new Set(errors)]
}

export function createPlanningHandoff(
  answers: PlanningAnswers,
  places: readonly HexRecord[],
): PlanningHandoff {
  const place = places.find((candidate) => candidate.h3 === answers.place)
  if (!place || !answers.role || !answers.goal || !answers.housingType) {
    throw new Error('Planning answers are incomplete.')
  }

  const placeName = place.neighborhood ?? place.muni
  const goal = GOAL_OPTIONS.find((option) => option.value === answers.goal)

  return {
    answers,
    configuration: {
      place: place.h3,
      type: answers.housingType,
      view: answers.goal === 'understand_need' ? 'need' : 'match',
      dimension: '2d',
    },
    weights: { ...answers.priorities },
    summary: `${goal?.label ?? 'Planning'} for ${TYPE_LABELS[answers.housingType]} in ${placeName}. Scenario rankings reflect the priorities you selected; map facts do not change.`,
  }
}
