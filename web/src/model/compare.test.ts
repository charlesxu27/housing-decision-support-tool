import { describe, expect, it } from 'vitest'
import { createLookupAllowed } from '../data/load'
import { buildArea, buildParcel, buildZoningMatrix } from '../test/builders'
import {
  COMPARE_LIMIT,
  addCompareRef,
  buildParcelProfile,
  buildTractProfile,
  rankPlaces,
  rankReason,
  rankingFlipNote,
  removeCompareRef,
  toggleCompareRef,
} from './compare'
import type { ValueWeights } from './scenarios'

const protectOnly: ValueWeights = {
  protectResidents: 100,
  lowCarbon: 0,
  climateSafety: 0,
  deepAffordability: 0,
  speedToBuild: 0,
}

const climateOnly: ValueWeights = {
  protectResidents: 0,
  lowCarbon: 0,
  climateSafety: 100,
  deepAffordability: 0,
  speedToBuild: 0,
}

const balanced: ValueWeights = {
  protectResidents: 50,
  lowCarbon: 50,
  climateSafety: 50,
  deepAffordability: 50,
  speedToBuild: 50,
}

const safer = buildArea({
  id: '42003000001',
  name: 'Tract 0001',
  neighborhood: 'Safer Place',
  neighborhoods: ['Safer Place'],
  needScores: { duplex_triplex: 0.4 },
  households: { cost_burdened_renters: 0.2 },
  risk: { displacement: 0.2, floodShare: 0.4, floodway: false },
  transitTrips800m: 200,
  allowed: { duplex_triplex: 'not_permitted' },
})

const needed = buildArea({
  id: '42003000002',
  name: 'Tract 0002',
  neighborhood: 'Needed Place',
  neighborhoods: ['Needed Place'],
  needScores: { duplex_triplex: 0.9 },
  households: { cost_burdened_renters: 0.7 },
  risk: { displacement: 0.8, floodShare: 0.02, floodway: false },
  transitTrips800m: 1_800,
  allowed: { duplex_triplex: 'by_right' },
})

describe('compare selection', () => {
  it('adds up to three places of the same kind', () => {
    const first = addCompareRef([], { kind: 'tract', id: 'a' })
    const second = addCompareRef(first.items, { kind: 'tract', id: 'b' })
    const third = addCompareRef(second.items, { kind: 'tract', id: 'c' })
    const fourth = addCompareRef(third.items, { kind: 'tract', id: 'd' })

    expect(first.added).toBe(true)
    expect(second.items).toHaveLength(2)
    expect(third.items).toHaveLength(COMPARE_LIMIT)
    expect(fourth.added).toBe(false)
    expect(fourth.reason).toMatch(/limited to 3/)
  })

  it('refuses to mix tracts and parcels', () => {
    const tracts = addCompareRef([], { kind: 'tract', id: 'a' })
    const mixed = addCompareRef(tracts.items, {
      kind: 'parcel',
      pin: '1',
      parcel: buildParcel(),
    })

    expect(mixed.added).toBe(false)
    expect(mixed.reason).toMatch(/tracts to tracts/)
  })

  it('toggles a place out of the list', () => {
    const added = addCompareRef([], { kind: 'tract', id: 'a' })
    const removed = toggleCompareRef(added.items, { kind: 'tract', id: 'a' })

    expect(removed.items).toEqual([])
    expect(removeCompareRef(added.items, { kind: 'tract', id: 'a' })).toEqual([])
  })
})

describe('place ranking', () => {
  const profiles = [
    buildTractProfile(safer, 'duplex_triplex'),
    buildTractProfile(needed, 'duplex_triplex'),
  ]

  it('keeps fact rows fixed while value scores change with the place', () => {
    const saferNeed = safer.needScores.duplex_triplex
    const neededNeed = needed.needScores.duplex_triplex
    expect(profiles[0].metrics.find((row) => row.id === 'need')?.score).toBe(saferNeed)
    expect(profiles[1].metrics.find((row) => row.id === 'need')?.score).toBe(neededNeed)
    expect(profiles[0].metrics.find((row) => row.id === 'allowed')?.provenance).toBe('law')
    expect(profiles[0].metrics.find((row) => row.id === 'flood')?.provenance).toBe('observed')
    expect(profiles[0].metrics.find((row) => row.id === 'protectResidents')?.role).toBe(
      'value',
    )
  })

  it('re-ranks when a single normative weight changes', () => {
    expect(rankPlaces(profiles, protectOnly)[0].id).toBe(safer.id)
    expect(rankPlaces(profiles, climateOnly)[0].id).toBe(needed.id)
  })

  it('names the priority that separates adjacent ranks', () => {
    const ranked = rankPlaces(profiles, protectOnly)
    const other = profiles.find((profile) => profile.id === ranked[1].id)!
    const reason = rankReason(ranked[0], other, ranked[1], true)

    expect(reason).toMatch(/Leads Tract 0002/)
    expect(reason).toMatch(/protect existing residents/)
  })

  it('explains a weight change that would flip first place', () => {
    const note = rankingFlipNote(profiles, {
      ...protectOnly,
      climateSafety: 20,
    })
    expect(note).toMatch(/stopped weighting protect existing residents/)
    expect(note).toMatch(/Tract 0002/)
  })

  it('excludes missing displacement from the score', () => {
    const missing = buildTractProfile(
      buildArea({ risk: { displacement: null } }),
      'duplex_triplex',
    )
    const ranked = rankPlaces([missing], balanced)

    expect(missing.valueScores.protectResidents).toBeNull()
    expect(ranked[0].excluded).toContain('protectResidents')
    expect(ranked[0].contributions.protectResidents).toBe(0)
  })

  it('does not mutate tract facts while ranking', () => {
    const before = structuredClone(profiles[0].valueScores)
    rankPlaces(profiles, { ...balanced, climateSafety: 100 })
    expect(profiles[0].valueScores).toEqual(before)
  })
})

describe('parcel profiles', () => {
  const lookup = createLookupAllowed(buildZoningMatrix())
  const area = buildArea({
    needScores: { adu: 0.8 },
    risk: { displacement: 0.4, floodShare: 0.1 },
  })

  it('scores lot hazards independently of the parent tract flood share', () => {
    const dry = buildParcelProfile(
      buildParcel({ pin: 'dry', flood: 0, floodway: 0 }),
      area,
      'adu',
      lookup,
    )
    const wet = buildParcelProfile(
      buildParcel({ pin: 'wet', flood: 1, floodway: 1 }),
      area,
      'adu',
      lookup,
    )

    expect(dry.valueScores.climateSafety).toBe(1)
    expect(wet.valueScores.climateSafety).toBe(0)
    expect(rankPlaces([dry, wet], climateOnly)[0].id).toBe('dry')
  })

  it('inherits tract need and displacement when the parent tract is present', () => {
    const profile = buildParcelProfile(buildParcel(), area, 'adu', lookup)
    expect(profile.valueScores.protectResidents).toBeCloseTo(0.6)
    expect(profile.metrics.find((row) => row.id === 'need')?.display).toMatch(/need/)
  })
})
