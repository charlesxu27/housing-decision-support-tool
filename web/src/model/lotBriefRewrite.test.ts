import { describe, expect, it } from 'vitest'
import { isLotBriefCard, rewriteLotBrief } from './lotBriefRewrite'

describe('lot brief rewrite', () => {
  it('accepts a card that has a pin and at least one type', () => {
    expect(isLotBriefCard({ pin: '0125', types: [{ id: 'adu' }] })).toBe(true)
    expect(isLotBriefCard({ pin: '', types: [{ id: 'adu' }] })).toBe(false)
    expect(isLotBriefCard({ pin: '0125', types: [] })).toBe(false)
    expect(isLotBriefCard(null)).toBe(false)
  })

  it('does not call the model when the key is missing', async () => {
    const result = await rewriteLotBrief({ pin: '0125', types: [{ id: 'adu' }] }, {})
    expect(result).toEqual({ engine: 'template' })
  })
})
