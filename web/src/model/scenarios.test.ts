import { describe, expect, it } from 'vitest'
import { buildArea } from '../test/builders'
import {
  BALANCED_WEIGHTS,
  VALUE_KEYS,
  buildScenarios,
  rankScenarios,
  scoreScenario,
  type ValueWeights,
} from './scenarios'

const area = buildArea({
  needScores: { adu: 0.8, duplex_triplex: 0.6, rehab_reuse: 0.4, large_apartment: 0.2, senior_accessible: 0.9 },
  allowed: {
    adu: 'by_right',
    duplex_triplex: 'special_exception',
    rehab_reuse: 'by_right',
    large_apartment: 'not_permitted',
    senior_accessible: 'conditional_use',
  },
  fit: {
    large_apartment: { band: 'low', parcels: 2, homes: [40, 160] },
  },
  risk: { displacement: 0.5, floodShare: 0.1 },
  transitTrips800m: 500,
})

describe('buildScenarios', () => {
  const scenarios = buildScenarios(area)
  const gentle = scenarios.find((scenario) => scenario.id === 'gentle_density')!
  const transit = scenarios.find((scenario) => scenario.id === 'transit_apartments')!

  it('allocates the target homes across the template mix', () => {
    expect(gentle.mix).toEqual({ adu: 10, duplex_triplex: 16, rehab_reuse: 14 })
    expect(transit.mix).toEqual({ large_apartment: 40 })
    expect(buildScenarios(area, 100)[0].mix).toEqual({
      adu: 25,
      duplex_triplex: 40,
      rehab_reuse: 35,
    })
  })

  it('derives zoning path, land fit, and hazards from the tract', () => {
    expect(gentle.facts.homesByRight).toBe(24)
    expect(gentle.facts.homesNeedApproval).toBe(16)
    expect(gentle.facts.homesNeedRezoning).toBe(0)
    expect(gentle.facts.suitableParcels).toBe(72)
    expect(gentle.facts.climateExposedHomes).toBe(4)
    expect(transit.facts.homesNeedRezoning).toBe(40)
    // 40 homes at the tract's own 20-80 homes-per-parcel range needs one parcel.
    expect(transit.facts.parcelsRequired).toBe(1)
    expect(transit.facts.suitableParcels).toBe(2)
  })

  it('derives household need served and displacement pressure', () => {
    expect(gentle.facts.householdsServedShare).toBeCloseTo(
      (10 * 0.8 + 16 * 0.6 + 14 * 0.4) / 40,
    )
    expect(gentle.facts.displacementPressure).toBeCloseTo(0.25)
    expect(transit.facts.displacementPressure).toBeCloseTo(0.45)
    expect(gentle.unavailable).toEqual([])
  })

  it('keeps every value score inside 0..1', () => {
    for (const scenario of scenarios) {
      for (const key of VALUE_KEYS) {
        const value = scenario.valueScores[key]
        expect(value).not.toBeNull()
        expect(value!).toBeGreaterThanOrEqual(0)
        expect(value!).toBeLessThanOrEqual(1)
      }
    }
  })

  it('propagates null inputs instead of substituting defaults', () => {
    const missing = buildArea({
      needScores: { adu: null },
      risk: { displacement: null },
    })
    const [gentleMissing, transitMissing] = buildScenarios(missing)

    expect(gentleMissing.facts.householdsServedShare).toBeNull()
    expect(gentleMissing.facts.displacementPressure).toBeNull()
    expect(gentleMissing.valueScores.deepAffordability).toBeNull()
    expect(gentleMissing.valueScores.protectResidents).toBeNull()
    expect(gentleMissing.unavailable).toHaveLength(2)
    // The transit template does not use ADUs, so only displacement is missing.
    expect(transitMissing.facts.householdsServedShare).not.toBeNull()
    expect(transitMissing.valueScores.protectResidents).toBeNull()
  })

  it('marks a floodway tract as climate-unsafe for every scenario', () => {
    for (const scenario of buildScenarios(buildArea({ risk: { floodway: true } }))) {
      expect(scenario.valueScores.climateSafety).toBe(0)
      expect(scenario.facts.climateExposedHomes).toBe(40)
    }
  })
})

describe('scenario scoring', () => {
  const scenarios = buildScenarios(area)

  it('re-ranks under a single normative value', () => {
    const protectOnly: ValueWeights = {
      protectResidents: 5,
      lowCarbon: 0,
      climateSafety: 0,
      deepAffordability: 0,
      speedToBuild: 0,
    }
    const speedOnly: ValueWeights = { ...protectOnly, protectResidents: 0, speedToBuild: 5 }

    expect(rankScenarios(scenarios, protectOnly)[0].scenarioId).toBe('senior_first')
    expect(rankScenarios(scenarios, protectOnly).at(-1)?.scenarioId).toBe(
      'transit_apartments',
    )
    expect(rankScenarios(scenarios, speedOnly)[0].scenarioId).toBe('gentle_density')
  })

  it('normalizes weight scale without changing the score', () => {
    const doubled: ValueWeights = {
      protectResidents: 2,
      lowCarbon: 2,
      climateSafety: 2,
      deepAffordability: 2,
      speedToBuild: 2,
    }

    expect(scoreScenario(scenarios[0], doubled).score).toBe(
      scoreScenario(scenarios[0], BALANCED_WEIGHTS).score,
    )
  })

  it('excludes null value rows and renormalizes the remaining weights', () => {
    const [gentleMissing] = buildScenarios(
      buildArea({ risk: { displacement: null } }),
    )
    const result = scoreScenario(gentleMissing, BALANCED_WEIGHTS)
    const available = VALUE_KEYS.filter((key) => key !== 'protectResidents')
    const expected =
      available.reduce((sum, key) => sum + (gentleMissing.valueScores[key] ?? 0), 0) /
      available.length

    expect(result.excluded).toEqual(['protectResidents'])
    expect(result.contributions.protectResidents).toBe(0)
    expect(result.score).toBeCloseTo(Math.round(expected * 1000) / 10, 0)
  })

  it('returns zero when no value has weight', () => {
    const noWeights: ValueWeights = {
      protectResidents: 0,
      lowCarbon: 0,
      climateSafety: 0,
      deepAffordability: 0,
      speedToBuild: 0,
    }

    expect(scoreScenario(scenarios[0], noWeights).score).toBe(0)
  })

  it('does not mutate scenario facts while ranking', () => {
    const factsBefore = structuredClone(scenarios[0].facts)

    rankScenarios(scenarios, { ...BALANCED_WEIGHTS, protectResidents: 4 })

    expect(scenarios[0].facts).toEqual(factsBefore)
  })
})
