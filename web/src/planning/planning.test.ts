import { describe, expect, it } from 'vitest'
import { ILLUSTRATIVE_HEXES } from '../data/fixtures'
import {
  DEFAULT_PRIORITIES,
  createPlanningHandoff,
  validatePlanningStep,
  type PlanningAnswers,
} from './planning'

const completeAnswers: PlanningAnswers = {
  role: 'municipal_staff',
  context: 'Housing strategy workshop',
  goal: 'understand_need',
  place: ILLUSTRATIVE_HEXES[0].h3,
  housingType: 'small_apartment',
  priorities: {
    ...DEFAULT_PRIORITIES,
    protectResidents: 90,
    speedToBuild: 25,
  },
  tradeoff: 'Add homes while limiting displacement pressure',
}

describe('planning wizard logic', () => {
  it('requires a valid geography on the place step', () => {
    expect(
      validatePlanningStep(
        2,
        { ...completeAnswers, place: 'not-a-fixture' },
        ILLUSTRATIVE_HEXES,
      ),
    ).toContain('Choose one of the available illustrative geographies.')
  })

  it('rejects priority values outside the supported range', () => {
    expect(
      validatePlanningStep(
        4,
        {
          ...completeAnswers,
          priorities: { ...DEFAULT_PRIORITIES, lowCarbon: 101 },
        },
        ILLUSTRATIVE_HEXES,
      ),
    ).toContain('Priority values must be between 0 and 100.')
  })

  it('maps a need-focused plan to a shareable map configuration', () => {
    const handoff = createPlanningHandoff(
      completeAnswers,
      ILLUSTRATIVE_HEXES,
    )

    expect(handoff.configuration).toEqual({
      place: ILLUSTRATIVE_HEXES[0].h3,
      type: 'small_apartment',
      view: 'need',
      dimension: '2d',
    })
    expect(handoff.weights.protectResidents).toBe(90)
    expect(handoff.summary).toContain('Small apartment building')
  })

  it('does not mutate priority answers while creating the handoff', () => {
    const before = structuredClone(completeAnswers)

    createPlanningHandoff(completeAnswers, ILLUSTRATIVE_HEXES)

    expect(completeAnswers).toEqual(before)
  })
})
