import type { Provenance, TypeId } from '../data/types'

export const VALUE_KEYS = [
  'protectResidents',
  'lowCarbon',
  'climateSafety',
  'deepAffordability',
  'speedToBuild',
] as const

export type ValueKey = (typeof VALUE_KEYS)[number]
export type ValueWeights = Record<ValueKey, number>
export type ValueScores = Record<ValueKey, number>

export interface ScenarioDefinition {
  id: 'gentle_density' | 'transit_apartments' | 'senior_first'
  name: string
  description: string
  mix: Partial<Record<TypeId, number>>
  facts: {
    householdsServedShare: number
    parcelsRequired: number
    suitableParcels: number
    homesByRight: number
    homesNeedApproval: number
    homesNeedRezoning: number
    displacementPressure: number
    carbonKgCo2ePerHome: [number, number]
    climateExposedHomes: number
    estimatedDeliveryMonths: number
  }
  valueScores: ValueScores
  provenance: {
    facts: Provenance
    valueScores: Provenance
  }
}

export interface ScenarioScore {
  scenarioId: ScenarioDefinition['id']
  score: number
  contributions: Record<ValueKey, number>
}

export const BALANCED_WEIGHTS: ValueWeights = {
  protectResidents: 1,
  lowCarbon: 1,
  climateSafety: 1,
  deepAffordability: 1,
  speedToBuild: 1,
}

/**
 * Illustrative scenario assumptions for local MVP behavior only.
 * Scores are normalized to 0..1, where higher always means better.
 */
export const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: 'gentle_density',
    name: 'Gentle density',
    description: 'ADUs, duplex homes, and rehabilitation spread across existing blocks.',
    mix: { adu: 10, duplex_triplex: 16, rehab_reuse: 14 },
    facts: {
      householdsServedShare: 0.62,
      parcelsRequired: 18,
      suitableParcels: 31,
      homesByRight: 20,
      homesNeedApproval: 6,
      homesNeedRezoning: 14,
      displacementPressure: 0.24,
      carbonKgCo2ePerHome: [95_000, 145_000],
      climateExposedHomes: 0,
      estimatedDeliveryMonths: 24,
    },
    valueScores: {
      protectResidents: 0.78,
      lowCarbon: 0.82,
      climateSafety: 0.95,
      deepAffordability: 0.58,
      speedToBuild: 0.72,
    },
    provenance: { facts: 'assumption', valueScores: 'assumption' },
  },
  {
    id: 'transit_apartments',
    name: 'Transit apartments',
    description: 'One 40-home apartment building near frequent East Busway service.',
    mix: { large_apartment: 40 },
    facts: {
      householdsServedShare: 0.71,
      parcelsRequired: 1,
      suitableParcels: 3,
      homesByRight: 0,
      homesNeedApproval: 40,
      homesNeedRezoning: 0,
      displacementPressure: 0.61,
      carbonKgCo2ePerHome: [120_000, 175_000],
      climateExposedHomes: 0,
      estimatedDeliveryMonths: 38,
    },
    valueScores: {
      protectResidents: 0.42,
      lowCarbon: 0.76,
      climateSafety: 0.9,
      deepAffordability: 0.7,
      speedToBuild: 0.4,
    },
    provenance: { facts: 'assumption', valueScores: 'assumption' },
  },
  {
    id: 'senior_first',
    name: 'Senior first',
    description: 'Accessible senior homes paired with ADUs for multigenerational living.',
    mix: { senior_accessible: 24, adu: 16 },
    facts: {
      householdsServedShare: 0.67,
      parcelsRequired: 11,
      suitableParcels: 19,
      homesByRight: 8,
      homesNeedApproval: 24,
      homesNeedRezoning: 8,
      displacementPressure: 0.18,
      carbonKgCo2ePerHome: [105_000, 155_000],
      climateExposedHomes: 0,
      estimatedDeliveryMonths: 30,
    },
    valueScores: {
      protectResidents: 0.88,
      lowCarbon: 0.74,
      climateSafety: 0.94,
      deepAffordability: 0.9,
      speedToBuild: 0.52,
    },
    provenance: { facts: 'assumption', valueScores: 'assumption' },
  },
] as const

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function validWeight(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/**
 * Returns a weighted 0..100 score. Weight scale is arbitrary because weights
 * are normalized; zero or invalid weights contribute nothing.
 */
export function scoreScenario(
  scenario: ScenarioDefinition,
  weights: ValueWeights,
): ScenarioScore {
  const weighted = VALUE_KEYS.map((key) => ({
    key,
    weight: validWeight(weights[key]),
    value: clampUnit(scenario.valueScores[key]),
  }))
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)

  const contributions = Object.fromEntries(
    weighted.map(({ key, weight, value }) => [
      key,
      totalWeight === 0 ? 0 : (value * weight * 100) / totalWeight,
    ]),
  ) as Record<ValueKey, number>

  const rawScore = Object.values(contributions).reduce(
    (sum, contribution) => sum + contribution,
    0,
  )

  return {
    scenarioId: scenario.id,
    score: Math.round(rawScore * 10) / 10,
    contributions,
  }
}

export function rankScenarios(
  scenarios: readonly ScenarioDefinition[],
  weights: ValueWeights,
): ScenarioScore[] {
  return scenarios
    .map((scenario) => scoreScenario(scenario, weights))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.scenarioId.localeCompare(right.scenarioId),
    )
}
