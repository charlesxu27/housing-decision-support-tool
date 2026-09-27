import type { AreaRecord, Provenance, TypeId } from '../data/types'

export const VALUE_KEYS = [
  'protectResidents',
  'lowCarbon',
  'climateSafety',
  'deepAffordability',
  'speedToBuild',
] as const

export type ValueKey = (typeof VALUE_KEYS)[number]
export type ValueWeights = Record<ValueKey, number>
/** 0..1 where higher is better; null when a required input was missing. */
export type ValueScores = Record<ValueKey, number | null>

export type ScenarioId = 'gentle_density' | 'transit_apartments' | 'senior_first'

export interface ScenarioFacts {
  /** Mean need score of the mix types; null when any contributing score is null. */
  householdsServedShare: number | null
  parcelsRequired: number
  suitableParcels: number
  homesByRight: number
  homesNeedApproval: number
  homesNeedRezoning: number
  homesZoningUnknown: number
  /** Template market-rate share x tract displacement index; null when the index is null. */
  displacementPressure: number | null
  /** Embodied carbon per home (assumption). */
  carbonKgCo2ePerHome: [number, number]
  climateExposedHomes: number
  estimatedDeliveryMonths: number
}

export interface ScenarioDefinition {
  id: ScenarioId
  name: string
  description: string
  mix: Partial<Record<TypeId, number>>
  facts: ScenarioFacts
  valueScores: ValueScores
  provenance: {
    facts: Provenance
    valueScores: Provenance
  }
  /** Facts that could not be computed from the tract, with the reason. */
  unavailable: string[]
}

export interface ScenarioScore {
  scenarioId: ScenarioId
  score: number
  contributions: Record<ValueKey, number>
  /** Value rows dropped from the score because their input was null. */
  excluded: ValueKey[]
}

export const BALANCED_WEIGHTS: ValueWeights = {
  protectResidents: 1,
  lowCarbon: 1,
  climateSafety: 1,
  deepAffordability: 1,
  speedToBuild: 1,
}

interface ScenarioTemplate {
  id: ScenarioId
  name: string
  description: string
  /** Shares of the target homes per type; sums to 1. */
  mixShares: Partial<Record<TypeId, number>>
  /** Assumed share of homes delivered at market rate. */
  marketRateShare: number
  /** Assumed embodied carbon per home, kg CO2e. */
  carbonKgCo2ePerHome: [number, number]
  /** Assumed delivery time when every home is by right. */
  baseDeliveryMonths: number
}

/**
 * Scenario templates. Everything here is an assumption: the mix, the
 * market-rate share, embodied-carbon ranges, and base delivery times. All
 * place-specific facts are derived from the selected tract in
 * `buildScenarios`.
 */
export const SCENARIO_TEMPLATES: readonly ScenarioTemplate[] = [
  {
    id: 'gentle_density',
    name: 'Gentle density',
    description:
      'ADUs, duplex homes, and rehabilitation spread across existing blocks.',
    mixShares: { adu: 0.25, duplex_triplex: 0.4, rehab_reuse: 0.35 },
    marketRateShare: 0.5,
    carbonKgCo2ePerHome: [95_000, 145_000],
    baseDeliveryMonths: 24,
  },
  {
    id: 'transit_apartments',
    name: 'Transit apartments',
    description: 'One apartment building near frequent transit service.',
    mixShares: { large_apartment: 1 },
    marketRateShare: 0.9,
    carbonKgCo2ePerHome: [120_000, 175_000],
    baseDeliveryMonths: 38,
  },
  {
    id: 'senior_first',
    name: 'Senior first',
    description:
      'Accessible senior homes paired with ADUs for multigenerational living.',
    mixShares: { senior_accessible: 0.6, adu: 0.4 },
    marketRateShare: 0.3,
    carbonKgCo2ePerHome: [105_000, 155_000],
    baseDeliveryMonths: 30,
  },
]

/**
 * Fallback homes-per-parcel ranges (assumption) used only when the tract has
 * no suitable parcels for a type, so the pipeline's own range cannot be read
 * from `fit.homes / fit.parcels`.
 */
export const HOMES_PER_PARCEL: Record<TypeId, [number, number]> = {
  adu: [1, 1],
  duplex_triplex: [2, 3],
  townhome: [3, 6],
  small_apartment: [6, 19],
  large_apartment: [20, 80],
  senior_accessible: [12, 40],
  rehab_reuse: [1, 2],
  detached_sf: [1, 1],
}

/** Embodied-carbon bounds used to normalize the carbon score (assumption). */
export const CARBON_BOUNDS_KG: [number, number] = [80_000, 200_000]
/** Weekday trips within 800 m treated as fully transit-served (assumption). */
export const TRANSIT_SATURATION_TRIPS = 1_000
/** Extra months added when no home is by right (assumption). */
export const DELIVERY_PENALTY_MONTHS = 24

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function validWeight(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function homesPerParcelMidpoint(area: AreaRecord, type: TypeId): number {
  const fit = area.fit[type]
  if (fit.parcels > 0) {
    const low = fit.homes[0] / fit.parcels
    const high = fit.homes[1] / fit.parcels
    const midpoint = (low + high) / 2
    if (midpoint > 0) return midpoint
  }
  const [low, high] = HOMES_PER_PARCEL[type]
  return (low + high) / 2
}

function allocateHomes(
  mixShares: Partial<Record<TypeId, number>>,
  targetHomes: number,
): Partial<Record<TypeId, number>> {
  const entries = Object.entries(mixShares) as [TypeId, number][]
  const mix: Partial<Record<TypeId, number>> = {}
  let assigned = 0
  entries.forEach(([type, share], index) => {
    const homes =
      index === entries.length - 1
        ? targetHomes - assigned
        : Math.round(targetHomes * share)
    mix[type] = Math.max(0, homes)
    assigned += mix[type] ?? 0
  })
  return mix
}

/**
 * Builds the three scenario templates for one tract. Every fact is derived
 * from the `AreaRecord`; a fact that depends on a null input becomes null and
 * the dependent value score is excluded from ranking.
 */
export function buildScenarios(
  area: AreaRecord,
  targetHomes = 40,
): ScenarioDefinition[] {
  return SCENARIO_TEMPLATES.map((template) => {
    const mix = allocateHomes(template.mixShares, targetHomes)
    const entries = Object.entries(mix) as [TypeId, number][]
    const homes = entries.reduce((sum, [, count]) => sum + count, 0)
    const unavailable: string[] = []

    const needScores = entries.map(([type]) => area.needScores[type])
    let householdsServedShare: number | null = null
    if (needScores.every((score): score is number => score != null)) {
      const weighted = entries.reduce(
        (sum, [type, count]) => sum + count * (area.needScores[type] ?? 0),
        0,
      )
      householdsServedShare = homes === 0 ? 0 : clampUnit(weighted / homes)
    } else {
      unavailable.push('Household need score is not available for a type in this mix.')
    }

    let parcelsRequired = 0
    let suitableParcels = 0
    let homesByRight = 0
    let homesNeedApproval = 0
    let homesNeedRezoning = 0
    let homesZoningUnknown = 0
    for (const [type, count] of entries) {
      parcelsRequired += Math.ceil(count / homesPerParcelMidpoint(area, type))
      suitableParcels += area.fit[type].parcels
      switch (area.allowed[type]) {
        case 'by_right':
          homesByRight += count
          break
        case 'special_exception':
        case 'conditional_use':
          homesNeedApproval += count
          break
        case 'not_permitted':
          homesNeedRezoning += count
          break
        case 'unknown':
          homesZoningUnknown += count
          break
      }
    }

    const displacementPressure =
      area.risk.displacement == null
        ? null
        : clampUnit(template.marketRateShare * area.risk.displacement)
    if (displacementPressure == null) {
      unavailable.push('Displacement index is not available for this tract.')
    }

    const climateExposedHomes = area.risk.floodway
      ? homes
      : Math.round(homes * area.risk.floodShare)

    const zoningPathShare =
      homes === 0 ? 0 : (homesByRight + 0.55 * homesNeedApproval) / homes
    const transitFactor = clampUnit(
      area.transitTrips800m / TRANSIT_SATURATION_TRIPS,
    )
    const speedToBuild = clampUnit(0.75 * zoningPathShare + 0.25 * transitFactor)
    const estimatedDeliveryMonths = Math.round(
      template.baseDeliveryMonths + DELIVERY_PENALTY_MONTHS * (1 - speedToBuild),
    )

    const carbonMidpoint =
      (template.carbonKgCo2ePerHome[0] + template.carbonKgCo2ePerHome[1]) / 2
    const lowCarbon = clampUnit(
      1 -
        (carbonMidpoint - CARBON_BOUNDS_KG[0]) /
          (CARBON_BOUNDS_KG[1] - CARBON_BOUNDS_KG[0]),
    )

    const climateSafety = area.risk.floodway
      ? 0
      : clampUnit(1 - (homes === 0 ? 0 : climateExposedHomes / homes))

    const valueScores: ValueScores = {
      protectResidents:
        displacementPressure == null ? null : clampUnit(1 - displacementPressure),
      lowCarbon,
      climateSafety,
      deepAffordability:
        householdsServedShare == null
          ? null
          : clampUnit(
              0.5 * householdsServedShare + 0.5 * (1 - template.marketRateShare),
            ),
      speedToBuild,
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      mix,
      facts: {
        householdsServedShare,
        parcelsRequired,
        suitableParcels,
        homesByRight,
        homesNeedApproval,
        homesNeedRezoning,
        homesZoningUnknown,
        displacementPressure,
        carbonKgCo2ePerHome: template.carbonKgCo2ePerHome,
        climateExposedHomes,
        estimatedDeliveryMonths,
      },
      valueScores,
      provenance: { facts: 'derived', valueScores: 'assumption' },
      unavailable,
    }
  })
}

/**
 * Returns a weighted 0..100 score. Weight scale is arbitrary because weights
 * are normalized; zero or invalid weights contribute nothing. Value rows whose
 * score is null are excluded and the remaining weights are renormalized.
 */
export function scoreScenario(
  scenario: ScenarioDefinition,
  weights: ValueWeights,
): ScenarioScore {
  const excluded = VALUE_KEYS.filter((key) => scenario.valueScores[key] == null)
  const weighted = VALUE_KEYS.map((key) => {
    const value = scenario.valueScores[key]
    return {
      key,
      weight: value == null ? 0 : validWeight(weights[key]),
      value: value == null ? 0 : clampUnit(value),
    }
  })
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
    excluded,
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
