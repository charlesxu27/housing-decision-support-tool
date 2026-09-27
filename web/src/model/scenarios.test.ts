import { describe, expect, it } from 'vitest'
import {
  BALANCED_WEIGHTS,
  rankScenarios,
  SCENARIOS,
  scoreScenario,
  type ValueWeights,
} from './scenarios'

describe('scenario scoring', () => {
  it('computes the hand-checked balanced score', () => {
    const gentleDensity = SCENARIOS[0]

    expect(scoreScenario(gentleDensity, BALANCED_WEIGHTS).score).toBe(77)
  })

  it('responds deterministically to one normative value', () => {
    const deepAffordabilityOnly: ValueWeights = {
      protectResidents: 0,
      lowCarbon: 0,
      climateSafety: 0,
      deepAffordability: 5,
      speedToBuild: 0,
    }

    expect(rankScenarios(SCENARIOS, deepAffordabilityOnly)).toEqual([
      expect.objectContaining({ scenarioId: 'senior_first', score: 90 }),
      expect.objectContaining({ scenarioId: 'transit_apartments', score: 70 }),
      expect.objectContaining({ scenarioId: 'gentle_density', score: 58 }),
    ])
  })

  it('normalizes weight scale without changing the score', () => {
    const doubledWeights: ValueWeights = {
      protectResidents: 2,
      lowCarbon: 2,
      climateSafety: 2,
      deepAffordability: 2,
      speedToBuild: 2,
    }

    expect(scoreScenario(SCENARIOS[0], doubledWeights).score).toBe(
      scoreScenario(SCENARIOS[0], BALANCED_WEIGHTS).score,
    )
  })

  it('returns zero when no value has weight', () => {
    const noWeights: ValueWeights = {
      protectResidents: 0,
      lowCarbon: 0,
      climateSafety: 0,
      deepAffordability: 0,
      speedToBuild: 0,
    }

    expect(scoreScenario(SCENARIOS[0], noWeights).score).toBe(0)
  })

  it('does not mutate scenario facts while ranking', () => {
    const factsBefore = structuredClone(SCENARIOS[0].facts)

    rankScenarios(SCENARIOS, {
      ...BALANCED_WEIGHTS,
      protectResidents: 4,
    })

    expect(SCENARIOS[0].facts).toEqual(factsBefore)
  })
})
