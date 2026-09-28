import { describe, expect, it } from 'vitest'
import { buildArea } from '../test/builders'
import {
  applyLenientFitBands,
  applyLenientNeedBands,
  describeNeedScore,
  describeSmallHouseholdGap,
  smallHomeShare,
} from './needBands'

describe('applyLenientNeedBands', () => {
  it('treats only the bottom tenth as low and keeps the top third high', () => {
    const areas = Array.from({ length: 10 }, (_, index) =>
      buildArea({
        id: `tract-${index}`,
        need: { adu: 'low' },
        needScores: { adu: (index + 1) / 10 },
      }),
    )

    applyLenientNeedBands(areas)

    expect(areas.map((area) => area.need.adu)).toEqual([
      'low',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'high',
      'high',
      'high',
    ])
  })

  it('leaves a missing score on its published band', () => {
    const low = buildArea({ id: 'low', need: { adu: 'high' }, needScores: { adu: 0.1 } })
    const high = buildArea({ id: 'high', need: { adu: 'low' }, needScores: { adu: 0.9 } })
    const missing = buildArea({
      id: 'missing',
      need: { adu: 'uncertain' },
      needScores: { adu: null },
    })

    applyLenientNeedBands([low, high, missing])

    expect(missing.need.adu).toBe('uncertain')
    expect(low.need.adu).toBe('low')
    expect(high.need.adu).toBe('high')
  })
})

describe('applyLenientFitBands', () => {
  it('keeps blue, needed-but-hard fit for tracts with no suitable lots', () => {
    const counts = [0, 1, 2, 3, 4, 5, 10, 20, 40, 80]
    const areas = counts.map((parcels, index) =>
      buildArea({
        id: `tract-${index}`,
        fit: { adu: { band: 'low', parcels, homes: [parcels, parcels] } },
      }),
    )

    applyLenientFitBands(areas)

    expect(areas.map((area) => area.fit.adu.band)).toEqual([
      'low',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'high',
      'high',
      'high',
    ])
  })
})

describe('need explanations', () => {
  it('compares small households with homes up through two bedrooms', () => {
    const area = buildArea({
      households: { hh_1_2: 0.85 },
      stock: { br_0_1: 0.54, br_2: 0.31 },
    })

    expect(smallHomeShare(area)).toBeCloseTo(0.85)
    expect(describeSmallHouseholdGap(area)).toBe(
      '1–2 person households 85% vs. 0–2 bedroom homes 85%',
    )
    expect(describeNeedScore(0.303)).toContain('0.30')
    expect(describeNeedScore(0.303)).toContain('lowest 10%')
  })
})
