import { describe, expect, it } from 'vitest'
import { createLookupAllowed } from '../data/load'
import {
  buildArea,
  buildParcel,
  buildSummary,
  buildZoningMatrix,
} from '../test/builders'
import {
  areaStatus,
  heaviestMember,
  parcelStatus,
  summarize,
} from './area'

const lookupAllowed = createLookupAllowed(buildZoningMatrix())

describe('areaStatus', () => {
  it('derives the tract status from need, fit, allowed, and floodway', () => {
    const area = buildArea({ allowed: { adu: 'conditional_use' } })
    expect(areaStatus(area, 'adu')).toBe('needs_approval')
    expect(areaStatus(buildArea({ risk: { floodway: true } }), 'adu')).toBe(
      'not_recommended',
    )
  })
})

describe('summarize', () => {
  const ready = buildArea({ id: '1', allowed: { adu: 'by_right' } })
  const approval = buildArea({ id: '2', allowed: { adu: 'conditional_use' } })
  const unknown = buildArea({ id: '3', inCity: false })
  const areasById = new Map([
    [ready.id, ready],
    [approval.id, approval],
    [unknown.id, unknown],
  ])
  const summary = buildSummary({
    members: [
      { id: '1', weight: 300 },
      { id: '2', weight: 500 },
      { id: '3', weight: 200 },
      { id: 'missing', weight: 900 },
    ],
  })

  it('weights member tracts by parcel overlap and keeps the breakdown', () => {
    const result = summarize(summary, areasById, 'adu', 'match')

    expect(result.totalWeight).toBe(1_000)
    expect(result.counts).toEqual({
      ready_match: 300,
      needs_approval: 500,
      zoning_unknown: 200,
    })
    expect(result.shares.needs_approval).toBeCloseTo(0.5)
    expect(result.plurality).toBe('needs_approval')
    expect(result.pluralityShare).toBeCloseTo(0.5)
    expect(result.missingMembers).toBe(1)
    expect(result.label).toBe(
      '50% Needs approval · 30% Ready match · 20% Zoning unknown',
    )
  })

  it('summarizes need bands in need mode', () => {
    const high = buildArea({ id: '1', need: { townhome: 'high' } })
    const low = buildArea({ id: '2', need: { townhome: 'low' } })
    const result = summarize(
      buildSummary({
        members: [
          { id: '1', weight: 10 },
          { id: '2', weight: 30 },
        ],
      }),
      new Map([
        ['1', high],
        ['2', low],
      ]),
      'townhome',
      'need',
    )

    expect(result.plurality).toBe('low')
    expect(result.pluralityShare).toBeCloseTo(0.75)
    expect(result.label).toBe('75% Low need · 25% High need')
  })

  it('returns no plurality when no member tract is loaded', () => {
    const result = summarize(summary, new Map(), 'adu', 'match')

    expect(result.plurality).toBeNull()
    expect(result.pluralityShare).toBe(0)
    expect(result.label).toBe('No scored tracts')
  })
})

describe('heaviestMember', () => {
  it('picks the loaded member with the most parcels', () => {
    const light = buildArea({ id: '1' })
    const heavy = buildArea({ id: '2' })
    const summary = buildSummary({
      members: [
        { id: '1', weight: 50 },
        { id: 'missing', weight: 999 },
        { id: '2', weight: 400 },
      ],
    })

    expect(
      heaviestMember(
        summary,
        new Map([
          ['1', light],
          ['2', heavy],
        ]),
      )?.id,
    ).toBe('2')
    expect(heaviestMember(summary, new Map())).toBeUndefined()
  })
})

describe('parcelStatus', () => {
  const area = buildArea({ need: { adu: 'high', duplex_triplex: 'high' } })

  it('resolves City parcels through the zoning matrix', () => {
    expect(parcelStatus(buildParcel({ zone: 'R1D-L' }), area, 'adu', lookupAllowed)).toBe(
      'ready_match',
    )
    expect(
      parcelStatus(buildParcel({ zone: 'R1D-L' }), area, 'duplex_triplex', lookupAllowed),
    ).toBe('needs_approval')
  })

  it('returns zoning unknown for parcels outside the City', () => {
    const outside = buildArea({ inCity: false, need: { adu: 'high' } })
    expect(
      parcelStatus(
        buildParcel({ zone: null, muni: 'Wilkinsburg', hood: null }),
        outside,
        'adu',
        lookupAllowed,
      ),
    ).toBe('zoning_unknown')
  })

  it('gates floodway parcels before any other check', () => {
    expect(
      parcelStatus(buildParcel({ floodway: 1, zone: 'R1D' }), area, 'adu', lookupAllowed),
    ).toBe('not_recommended')
  })

  it('treats a failed fit flag as needed but hard', () => {
    expect(
      parcelStatus(buildParcel({ f_adu: 0 }), area, 'adu', lookupAllowed),
    ).toBe('needed_but_hard')
  })

  it('reports insufficient data when the tract is not loaded', () => {
    expect(parcelStatus(buildParcel(), undefined, 'adu', lookupAllowed)).toBe(
      'insufficient_data',
    )
  })
})
