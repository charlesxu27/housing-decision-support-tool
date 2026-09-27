import { describe, expect, it } from 'vitest'
import { citeSources, sourceLabel } from './citations'
import type { SourceRecord } from './types'

function source(id: string, available = true): SourceRecord {
  return {
    id,
    title: `${id} title`,
    publisher: 'Publisher',
    catalogUrl: `https://example.org/${id}`,
    resourceUrl: `https://example.org/${id}/file`,
    geography: 'tract',
    vintage: '2024',
    retrievedAt: '2026-09-27',
    sha256: null,
    license: 'Public domain',
    fieldsRetained: [],
    notes: '',
    available,
  }
}

describe('citeSources', () => {
  const sources = [source('acs5'), source('chas', false), source('flood')]

  it('returns sources in the requested order and skips unknown ids', () => {
    expect(citeSources(sources, ['flood', 'missing', 'acs5']).map((item) => item.id)).toEqual([
      'flood',
      'acs5',
    ])
  })

  it('keeps the first occurrence when an id is requested twice', () => {
    expect(citeSources(sources, ['acs5', 'acs5']).map((item) => item.id)).toEqual(['acs5'])
  })

  it('uses the short label when one is defined', () => {
    expect(sourceLabel(source('acs5'))).toBe('ACS 5-year')
    expect(sourceLabel(source('custom'))).toBe('custom title')
  })
})
