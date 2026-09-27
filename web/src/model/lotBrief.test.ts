import { describe, expect, it } from 'vitest'
import { createLookupAllowed } from '../data/load'
import { buildArea, buildParcel, buildZoningMatrix } from '../test/builders'
import { buildLotBriefCard, templateLotBrief } from './lotBrief'

describe('lot brief', () => {
  it('uses snapshot fit and zoning status instead of inventing scores', () => {
    const matrix = buildZoningMatrix()
    const card = buildLotBriefCard({
      parcel: buildParcel({ lot: 4_200, f_adu: 0, zone: 'R1D-L' }),
      area: buildArea({ need: { adu: 'high' } }),
      type: 'adu',
      lookupAllowed: createLookupAllowed(matrix),
    })

    expect(card.selectedStatus).toBe('needed_but_hard')
    expect(card.types.find((row) => row.id === 'adu')?.fit).toBe('fails')
    const text = templateLotBrief(card)
    expect(text.headline).toMatch(/Needed but hard/)
    expect(text.transit).toMatch(/1,940/)
    expect(text.demand).toMatch(/high/)
  })
})
