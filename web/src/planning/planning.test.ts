import { describe, expect, it } from 'vitest'
import { buildArea, buildSummary } from '../test/builders'
import {
  DEFAULT_PRIORITIES,
  INVALID_PLACE_MESSAGE,
  createPlanningHandoff,
  normalizePlanningAnswers,
  validatePlanningStep,
  type PlanningAnswers,
} from './planning'

const light = buildArea({ id: '42003130700', name: 'Tract 1307' })
const heavy = buildArea({ id: '42003141200', name: 'Tract 1412' })
const areasById = new Map([
  [light.id, light],
  [heavy.id, heavy],
])
const summaries = [
  buildSummary({
    id: 'muni:wilkinsburg',
    kind: 'municipality',
    label: 'Wilkinsburg',
    municipality: 'Wilkinsburg',
    members: [
      { id: light.id, weight: 120 },
      { id: heavy.id, weight: 640 },
    ],
  }),
]

const completeAnswers: PlanningAnswers = {
  role: 'municipal_staff',
  context: 'Housing strategy workshop',
  goal: 'understand_need',
  place: 'muni:wilkinsburg',
  housingTypes: ['small_apartment'],
  priorities: {
    ...DEFAULT_PRIORITIES,
    protectResidents: 90,
    speedToBuild: 25,
  },
  tradeoff: 'Add homes while limiting displacement pressure',
}

describe('planning wizard logic', () => {
  it('requires a loaded summary area on the place step', () => {
    expect(
      validatePlanningStep(
        2,
        { ...completeAnswers, place: 'hood:not-loaded' },
        summaries,
      ),
    ).toContain(INVALID_PLACE_MESSAGE)
    expect(validatePlanningStep(2, completeAnswers, summaries)).toEqual([])
  })

  it('rejects priority values outside the supported range', () => {
    expect(
      validatePlanningStep(
        4,
        {
          ...completeAnswers,
          priorities: { ...DEFAULT_PRIORITIES, lowCarbon: 101 },
        },
        summaries,
      ),
    ).toContain('Priority values must be between 0 and 100.')
  })

  it('resolves the chosen summary to its heaviest member tract', () => {
    const handoff = createPlanningHandoff(completeAnswers, summaries, areasById)

    expect(handoff.configuration).toEqual({
      place: '42003141200',
      type: 'small_apartment',
      view: 'need',
      dimension: '2d',
    })
    expect(handoff.weights.protectResidents).toBe(90)
    expect(handoff.summary).toContain('Small apartment building')
    expect(handoff.summary).toContain('Wilkinsburg')
    expect(handoff.summary).toContain('Tract 1412')
  })

  it('fails loudly when no member tract is loaded', () => {
    expect(() =>
      createPlanningHandoff(completeAnswers, summaries, new Map()),
    ).toThrow('Wilkinsburg')
  })

  it('requires at least one housing type', () => {
    expect(
      validatePlanningStep(3, { ...completeAnswers, housingTypes: [] }, summaries),
    ).toContain('Choose an option before continuing.')
  })

  it('opens the map on the first selected housing type', () => {
    const handoff = createPlanningHandoff(
      { ...completeAnswers, housingTypes: ['adu', 'small_apartment'] },
      summaries,
      areasById,
    )

    expect(handoff.configuration.type).toBe('adu')
    expect(handoff.summary).toContain('Accessory dwelling unit (ADU)')
    expect(handoff.summary).toContain('Small apartment building')
    expect(handoff.summary).toContain('The map starts on Accessory dwelling unit (ADU)')
  })

  it('keeps a previously saved single housing type', () => {
    expect(
      normalizePlanningAnswers({
        role: 'municipal_staff',
        housingType: 'duplex_triplex',
      }).housingTypes,
    ).toEqual(['duplex_triplex'])
  })

  it('does not mutate priority answers while creating the handoff', () => {
    const before = structuredClone(completeAnswers)

    createPlanningHandoff(completeAnswers, summaries, areasById)

    expect(completeAnswers).toEqual(before)
  })
})
