import { describe, expect, it } from 'vitest'
import { parseMapConfiguration, toMapSearch } from './mapState'

const places = [{ h3: 'first' }, { h3: 'second' }]

describe('map URL state', () => {
  it('parses a valid shared view', () => {
    expect(
      parseMapConfiguration(
        '?place=second&type=adu&view=need&dimension=3d',
        places,
      ),
    ).toEqual({
      place: 'second',
      type: 'adu',
      view: 'need',
      dimension: '3d',
    })
  })

  it('falls back safely for unsupported values', () => {
    expect(
      parseMapConfiguration(
        '?place=missing&type=castle&view=other&dimension=4d',
        places,
      ),
    ).toEqual({
      place: 'first',
      type: 'duplex_triplex',
      view: 'match',
      dimension: '2d',
    })
  })

  it('serializes the established map query keys', () => {
    expect(
      toMapSearch({
        place: 'second',
        type: 'townhome',
        view: 'match',
        dimension: '2d',
      }),
    ).toBe('?place=second&type=townhome&view=match&dimension=2d')
  })
})
