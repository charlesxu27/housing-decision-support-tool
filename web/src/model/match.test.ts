import { describe, expect, it } from 'vitest'
import { deriveMatchStatus, explainMatch, type MatchInputs } from './match'

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

describe('explainMatch', () => {
  const outcomes = (inputs: MatchInputs) =>
    explainMatch(inputs).checks.map((check) => check.outcome)

  it('passes every check for a ready match', () => {
    const explanation = explainMatch({ ...viable, allowed: 'by_right' })
    expect(explanation.status).toBe('ready_match')
    expect(outcomes({ ...viable, allowed: 'by_right' })).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
    ])
    expect(explanation.checks.every((check) => check.considered)).toBe(true)
    expect(explanation.checks.find((check) => check.decisive)?.id).toBe(
      'allowed',
    )
  })

  it('marks checks after a hard gate as not considered', () => {
    const explanation = explainMatch({
      need: 'low',
      fit: 'high',
      allowed: 'by_right',
      floodway: false,
    })
    expect(explanation.status).toBe('low_priority')
    expect(
      explanation.checks.map(({ id, considered, decisive }) => [
        id,
        considered,
        decisive,
      ]),
    ).toEqual([
      ['floodway', true, false],
      ['need', true, true],
      ['fit', false, false],
      ['allowed', false, false],
    ])
  })

  it('points insufficient data at the first missing input', () => {
    const explanation = explainMatch({ need: 'high', fit: 'high', floodway: false })
    expect(explanation.status).toBe('insufficient_data')
    expect(explanation.checks.find((check) => check.decisive)?.id).toBe(
      'allowed',
    )
    expect(outcomes({ need: 'high', fit: 'high', floodway: false })[3]).toBe(
      'unknown',
    )
  })

  it('flags approval paths and uncertain bands as cautions', () => {
    expect(
      outcomes({
        need: 'uncertain',
        fit: 'high',
        allowed: 'conditional_use',
        floodway: false,
      }),
    ).toEqual(['pass', 'caution', 'pass', 'caution'])
  })

  it.each<MatchInputs>([
    { need: 'low', fit: 'low', allowed: 'by_right', floodway: true },
    { need: 'high', fit: 'low', allowed: 'not_permitted', floodway: false },
    { need: 'medium', fit: 'medium', allowed: 'unknown', floodway: false },
    { need: 'high', fit: 'high', allowed: 'special_exception', floodway: false },
    { need: 'high', fit: 'high', allowed: 'by_right' },
  ])('always agrees with deriveMatchStatus', (inputs) => {
    expect(explainMatch(inputs).status).toBe(deriveMatchStatus(inputs))
  })
})
