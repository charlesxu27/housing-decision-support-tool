import { describe, expect, it } from 'vitest'
import { buildArea, buildSummary } from '../test/builders'
import {
  DEFAULT_PRIORITIES,
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
  priorities: DEFAULT_PRIORITIES,
  tradeoff: '',
}

describe('planning wizard logic', () => {
  it('opens the map without a wizard place by using a loaded tract', () => {
    const handoff = createPlanningHandoff(
      { ...completeAnswers, place: '' },
      summaries,
      areasById,
    )

    expect(handoff.configuration.place).toBe(light.id)
    expect(handoff.summary).toContain('Choose a municipality or neighborhood on the map')
  })

  it('resolves the chosen summary to its heaviest member tract', () => {
    const handoff = createPlanningHandoff(completeAnswers, summaries, areasById)

    expect(handoff.configuration).toEqual({
      place: '42003141200',
      type: 'small_apartment',
      view: 'need',
      dimension: '2d',
    })
    expect(handoff.weights).toEqual(DEFAULT_PRIORITIES)
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
      validatePlanningStep(2, { ...completeAnswers, housingTypes: [] }, summaries),
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

  it('drops previously saved priority sliders', () => {
    expect(
      normalizePlanningAnswers({
        role: 'municipal_staff',
        priorities: { ...DEFAULT_PRIORITIES, protectResidents: 90 },
      }).priorities,
    ).toEqual(DEFAULT_PRIORITIES)
  })

  it('does not mutate answers while creating the handoff', () => {
    const before = structuredClone(completeAnswers)

    createPlanningHandoff(completeAnswers, summaries, areasById)

    expect(completeAnswers).toEqual(before)
  })

  it('opens the map with balanced default weights', () => {
    const handoff = createPlanningHandoff(
      {
        ...completeAnswers,
        priorities: { ...DEFAULT_PRIORITIES, protectResidents: 90 },
      },
      summaries,
      areasById,
    )

    expect(handoff.weights).toEqual(DEFAULT_PRIORITIES)
  })
})
