import { describe, expect, it } from 'vitest'
import { buildArea } from '../test/builders'
import { buildGroundedAnswer } from './answers'
import { retrieveKnowledge } from './retrieval'

describe('retrieveKnowledge', () => {
  it.each([
    ['Which data sources and vintages does the map use?', 'data-sources'],
    ['How do need, fit, parcels, and allowed make a match?', 'need-fit-allowed'],
    ['Why is zoning unknown outside the city and what is missing?', 'coverage-limits'],
    ['Can I build this by right under current zoning?', 'zoning-verification'],
    ['What floodway, slope, and undermining hazards matter?', 'climate-hazards'],
    ['What should a planner verify next with residents?', 'human-next-steps'],
  ])('ranks the relevant source first for "%s"', (query, expectedId) => {
    expect(retrieveKnowledge(query)[0]?.snippet.id).toBe(expectedId)
  })

  it('returns no snippets when the corpus cannot ground the query', () => {
    expect(retrieveKnowledge('quasars sonnets and sourdough')).toEqual([])
  })

  it('uses corpus order as a deterministic tie-breaker', () => {
    const results = retrieveKnowledge('allowed verify')

    expect(results.map(({ snippet }) => snippet.id)).toEqual([
      'zoning-verification',
      'need-fit-allowed',
      'human-next-steps',
    ])
  })
})

describe('buildGroundedAnswer', () => {
  const selectedArea = buildArea({
    allowed: { townhome: 'special_exception' },
    risk: { displacement: null, slopeShare: 0.04 },
  })

  it('grounds every answer section in a labeled citation', () => {
    const answer = buildGroundedAnswer({
      query: 'What zoning approval and ordinance checks remain?',
      selectedArea,
      selectedType: 'townhome',
      matchStatus: 'needs_approval',
      zoningDraft: true,
    })
    const citationIds = new Set(answer.citations.map(({ id }) => id))

    expect(answer.status).toBe('answer')
    expect(answer.citations[0]?.label).toBe(
      'Selected tract: Tract 1307, Homewood North, Pittsburgh (GEOID 42003130700)',
    )
    expect(answer.citations.some(({ label }) => label.includes('zoning'))).toBe(
      true,
    )
    expect(answer.sections[0]?.text).toContain('special exception')
    expect(answer.sections[0]?.text).toContain('draft, not human-verified')
    expect(answer.sections[0]?.text).toContain('needs approval')
    expect(answer.sections[0]?.text).toContain('1,940 weekday transit trips')
    expect(answer.sections[0]?.text).toContain('displacement index not available')
    expect(answer.sections[0]?.text).not.toMatch(/fixture|illustrative/i)
    expect(
      answer.sections.every(
        ({ citationIds: sectionCitationIds }) =>
          sectionCitationIds.length > 0 &&
          sectionCitationIds.every((id) => citationIds.has(id)),
      ),
    ).toBe(true)
  })

  it('explains unknown zoning outside the City', () => {
    const answer = buildGroundedAnswer({
      query: 'What zoning checks remain?',
      selectedArea: buildArea({ inCity: false }),
      selectedType: 'adu',
    })

    expect(answer.sections[0]?.text).toContain('outside the City of Pittsburgh')
  })

  it('returns a transparent no-result state without unsupported citations', () => {
    const answer = buildGroundedAnswer({
      query: 'quasars sonnets and sourdough',
      selectedArea,
      selectedType: 'adu',
    })

    expect(answer.status).toBe('no-result')
    expect(answer.title).toBe('No grounded answer found')
    expect(answer.sourceCheckLabel).toBe('No matching local source')
    expect(answer.citations).toEqual([])
    expect(answer.sections[0]?.citationIds).toEqual([])
  })
})
