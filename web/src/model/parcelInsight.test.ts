import { describe, expect, it } from 'vitest'
import { buildArea, buildParcel, buildZoningMatrix } from '../test/builders'
import { explainParcel } from './parcelInsight'

const matrix = buildZoningMatrix()
const area = buildArea({ need: { adu: 'high', duplex_triplex: 'high' } })

function explain(
  parcel: ReturnType<typeof buildParcel>,
  type: 'adu' | 'duplex_triplex' | 'townhome' | 'small_apartment' | 'rehab_reuse' = 'adu',
  tract = area,
) {
  return explainParcel({
    parcel,
    area: tract,
    type,
    matrix,
    zoningDraft: true,
  })
}

function fit(insight: ReturnType<typeof explain>) {
  return insight.checks.find((check) => check.id === 'fit')
}

function zoning(insight: ReturnType<typeof explain>) {
  return insight.checks.find((check) => check.id === 'allowed')
}

describe('explainParcel', () => {
  it('explains a ready match from this lot’s fit flag and zoning row', () => {
    const insight = explain(buildParcel({ zone: 'R1D-L' }), 'adu')
    expect(insight.status).toBe('ready_match')
    expect(insight.verdict).toContain('by right')
    expect(fit(insight)?.result).toBe('Passes the fit rule')
    expect(zoning(insight)?.metrics.join(' ')).toContain('911.02')
    expect(zoning(insight)?.metrics.join(' ')).toContain('R1D family')
    expect(zoning(insight)?.metrics.join(' ')).toContain('draft')
    expect(zoning(insight)?.considered).toBe(true)
  })

  it('names the lot-size miss that made an ADU blue', () => {
    const insight = explain(buildParcel({ lot: 4_200, f_adu: 0 }))
    expect(insight.status).toBe('needed_but_hard')
    expect(fit(insight)?.metrics[0]).toContain('4,200 sq ft')
    expect(fit(insight)?.metrics[0]).toContain('5,000')
    expect(zoning(insight)?.considered).toBe(false)
  })

  it('attributes a failed house conversion to finished area', () => {
    const insight = explain(
      buildParcel({
        use: 'sf_detached',
        bldg: 1,
        lot: 5_000,
        slope: 0,
        f_duplex_triplex: 0,
      }),
      'duplex_triplex',
    )
    expect(fit(insight)?.metrics[0]).toContain('2,400 sq ft')
  })

  it('rules out a floodway lot before fit or zoning', () => {
    const insight = explain(buildParcel({ floodway: 1, zone: 'R1D' }))
    expect(insight.status).toBe('not_recommended')
    expect(insight.checks.find((check) => check.id === 'floodway')?.decisive).toBe(true)
    expect(fit(insight)?.considered).toBe(false)
  })

  it('says zoning is unknown outside the City', () => {
    const outside = buildArea({ inCity: false, need: { adu: 'high' } })
    const insight = explain(
      buildParcel({ zone: null, muni: 'Wilkinsburg', hood: null }),
      'adu',
      outside,
    )
    expect(insight.status).toBe('zoning_unknown')
    expect(zoning(insight)?.metrics.join(' ')).toContain('Wilkinsburg')
  })

  it('explains a townhome failure from current use', () => {
    const insight = explain(
      buildParcel({ use: 'sf_detached', f_townhome: 0 }),
      'townhome',
    )
    expect(fit(insight)?.metrics[0]).toContain('vacant')
  })
})
