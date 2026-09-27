import { getResolution, isValidCell } from 'h3-js'
import { describe, expect, it } from 'vitest'
import { deriveMatchStatus } from '../model/match'
import { FIXTURE_DATASET, ILLUSTRATIVE_HEXES } from './fixtures'
import { TYPE_IDS, type MatchStatus } from './types'

describe('illustrative hex fixtures', () => {
  it('contains valid resolution-8 H3 cells around the named places', () => {
    expect(ILLUSTRATIVE_HEXES.length).toBeGreaterThanOrEqual(8)

    for (const hex of ILLUSTRATIVE_HEXES) {
      expect(isValidCell(hex.h3), hex.h3).toBe(true)
      expect(getResolution(hex.h3), hex.h3).toBe(8)
    }

    expect(new Set(ILLUSTRATIVE_HEXES.map((hex) => hex.muni))).toEqual(
      new Set(['Pittsburgh', 'Wilkinsburg', 'Swissvale']),
    )
  })

  it('has a complete contract for every housing type', () => {
    for (const hex of ILLUSTRATIVE_HEXES) {
      expect(Object.keys(hex.need).sort()).toEqual([...TYPE_IDS].sort())
      expect(Object.keys(hex.fit).sort()).toEqual([...TYPE_IDS].sort())
      expect(Object.keys(hex.allowed).sort()).toEqual([...TYPE_IDS].sort())
    }
  })

  it('is unmistakably labeled illustrative and non-authoritative', () => {
    expect(FIXTURE_DATASET.kind).toBe('illustrative_fixture')
    expect(FIXTURE_DATASET.authoritative).toBe(false)
    expect(FIXTURE_DATASET.notice.toLowerCase()).toContain('illustrative')
    expect(FIXTURE_DATASET.notice.toLowerCase()).toContain('not authoritative')
  })

  it('provides fixture examples for every data-backed match result', () => {
    const statuses = new Set<MatchStatus>(
      ILLUSTRATIVE_HEXES.map((hex) =>
        deriveMatchStatus({
          need: hex.need.duplex_triplex,
          fit: hex.fit.duplex_triplex.band,
          allowed: hex.allowed.duplex_triplex,
          floodway: hex.risk.floodway,
        }),
      ),
    )

    expect(statuses).toEqual(
      new Set<MatchStatus>([
        'not_recommended',
        'low_priority',
        'needed_but_hard',
        'ready_match',
        'needs_approval',
        'blocked_by_zoning',
        'zoning_unknown',
      ]),
    )
  })
})
