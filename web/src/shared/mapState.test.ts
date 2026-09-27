import { describe, expect, it } from 'vitest'
import { parseMapConfiguration, toMapSearch } from './mapState'

const places = [{ id: '42003130700' }, { id: '42003141200' }]

describe('map URL state', () => {
  it('parses a deep link by tract GEOID', () => {
    expect(
      parseMapConfiguration(
        '?place=42003141200&type=adu&view=need&dimension=3d',
        places,
      ),
    ).toEqual({
      place: '42003141200',
      type: 'adu',
      view: 'need',
      dimension: '3d',
    })
  })

  it('falls back to the first loaded tract for unsupported values', () => {
    expect(
      parseMapConfiguration(
        '?place=882a847267fffff&type=castle&view=other&dimension=4d',
        places,
      ),
    ).toEqual({
      place: '42003130700',
      type: 'duplex_triplex',
      view: 'match',
      dimension: '2d',
    })
  })

  it('returns an empty place when nothing is loaded', () => {
    expect(parseMapConfiguration('?place=42003130700', []).place).toBe('')
  })

  it('serializes the established map query keys', () => {
    expect(
      toMapSearch({
        place: '42003141200',
        type: 'townhome',
        view: 'match',
        dimension: '2d',
      }),
    ).toBe('?place=42003141200&type=townhome&view=match&dimension=2d')
  })
})
