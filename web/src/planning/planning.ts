import type { AreaRecord, SummaryArea, TypeId } from '../data/types'
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
export type PriorityKey = keyof ValueWeights

export interface PlanningAnswers {
  role: RoleId | ''
  context: string
  goal: GoalId | ''
  /** Municipality or neighborhood `SummaryArea.id` chosen in the wizard. */
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
    explanation: 'Raises approaches with a simpler modeled delivery path.',
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

export const INVALID_PLACE_MESSAGE =
  'Choose a municipality or Pittsburgh neighborhood from the loaded data.'

export function validatePlanningStep(
  step: number,
  answers: PlanningAnswers,
  validPlaces: readonly Pick<SummaryArea, 'id'>[],
): string[] {
  const errors: string[] = []
  const required = REQUIRED_BY_STEP[step] ?? []

  for (const field of required) {
    if (!answers[field]) errors.push(`Choose an option before continuing.`)
  }

  if (step === 2 && !validPlaces.some((place) => place.id === answers.place)) {
    errors.push(INVALID_PLACE_MESSAGE)
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

/**
 * Turns wizard answers into a shareable map configuration. The chosen
 * summary area resolves to its heaviest member tract, which is what the map
 * selects and reports on.
 */
export function createPlanningHandoff(
  answers: PlanningAnswers,
  summaries: readonly SummaryArea[],
  areasById: ReadonlyMap<string, AreaRecord>,
): PlanningHandoff {
  const summary = summaries.find((candidate) => candidate.id === answers.place)
  if (!summary || !answers.role || !answers.goal || !answers.housingType) {
    throw new Error('Planning answers are incomplete.')
  }

  const tract = heaviestMember(summary, areasById)
  if (!tract) {
    throw new Error(`No loaded tract belongs to ${summary.label}.`)
  }

  const goal = GOAL_OPTIONS.find((option) => option.value === answers.goal)

  return {
    answers,
    configuration: {
      place: tract.id,
      type: answers.housingType,
      view: answers.goal === 'understand_need' ? 'need' : 'match',
      dimension: '2d',
    },
    weights: { ...answers.priorities },
    summary: `${goal?.label ?? 'Planning'} for ${TYPE_LABELS[answers.housingType]} in ${summary.label}, starting from ${tract.name}. Scenario rankings reflect the priorities you selected; map facts do not change.`,
  }
}
