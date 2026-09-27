import { describe, expect, it } from 'vitest'
import { deriveMatchStatus, type MatchInputs } from './match'

const viable = {
  need: 'high',
  fit: 'high',
  floodway: false,
} as const

describe('deriveMatchStatus', () => {
  it('hard-gates a floodway before every other input', () => {
    expect(
      deriveMatchStatus({
        need: 'low',
        fit: 'low',
        allowed: 'by_right',
        floodway: true,
      }),
    ).toBe('not_recommended')
  })

  it('returns low priority when need is low', () => {
    expect(
      deriveMatchStatus({
        need: 'low',
        fit: 'high',
        allowed: 'by_right',
        floodway: false,
      }),
    ).toBe('low_priority')
  })

  it('returns needed but hard when fit is low', () => {
    expect(
      deriveMatchStatus({
        need: 'high',
        fit: 'low',
        allowed: 'by_right',
        floodway: false,
      }),
    ).toBe('needed_but_hard')
  })

  it('maps by-right zoning to a ready match', () => {
    expect(deriveMatchStatus({ ...viable, allowed: 'by_right' })).toBe(
      'ready_match',
    )
  })

  it.each(['special_exception', 'conditional_use'] as const)(
    'maps %s zoning to needs approval',
    (allowed) => {
      expect(deriveMatchStatus({ ...viable, allowed })).toBe('needs_approval')
    },
  )

  it('maps prohibited zoning to blocked by zoning', () => {
    expect(deriveMatchStatus({ ...viable, allowed: 'not_permitted' })).toBe(
      'blocked_by_zoning',
    )
  })

  it('keeps explicitly unknown zoning distinct', () => {
    expect(deriveMatchStatus({ ...viable, allowed: 'unknown' })).toBe(
      'zoning_unknown',
    )
  })

  it.each<MatchInputs>([
    { fit: 'high', allowed: 'by_right', floodway: false },
    { need: 'high', allowed: 'by_right', floodway: false },
    { need: 'high', fit: 'high', floodway: false },
    { need: 'high', fit: 'high', allowed: 'by_right' },
    { need: null, fit: 'high', allowed: 'by_right', floodway: false },
  ])('returns insufficient data for missing model inputs', (inputs) => {
    expect(deriveMatchStatus(inputs)).toBe('insufficient_data')
  })

  it('treats uncertain need and fit as viable bands', () => {
    expect(
      deriveMatchStatus({
        need: 'uncertain',
        fit: 'uncertain',
        allowed: 'by_right',
        floodway: false,
      }),
    ).toBe('ready_match')
  })
})
