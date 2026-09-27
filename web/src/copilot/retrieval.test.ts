import { describe, expect, it } from 'vitest'
import { ILLUSTRATIVE_HEXES } from '../data/fixtures'
import { buildGroundedAnswer } from './answers'
import { retrieveKnowledge } from './retrieval'

describe('retrieveKnowledge', () => {
  it.each([
    ['Is this data authoritative or just a demo fixture?', 'fixture-limitations'],
    ['How do need, fit, parcels, and allowed make a match?', 'need-fit-allowed'],
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
  const selectedHex = ILLUSTRATIVE_HEXES[0]

  it('grounds every answer section in a labeled citation', () => {
    const answer = buildGroundedAnswer({
      query: 'What zoning approval and ordinance checks remain?',
      selectedHex,
      selectedType: 'townhome',
      matchStatus: 'needs_approval',
    })
    const citationIds = new Set(answer.citations.map(({ id }) => id))

    expect(answer.status).toBe('answer')
    expect(answer.citations[0]?.label).toContain('Selected fixture:')
    expect(answer.citations.some(({ label }) => label.includes('zoning'))).toBe(
      true,
    )
    expect(answer.sections[0]?.text).toContain('fixture values')
    expect(answer.sections[0]?.text).toContain('needs approval')
    expect(
      answer.sections.every(
        ({ citationIds: sectionCitationIds }) =>
          sectionCitationIds.length > 0 &&
          sectionCitationIds.every((id) => citationIds.has(id)),
      ),
    ).toBe(true)
  })

  it('returns a transparent no-result state without unsupported citations', () => {
    const answer = buildGroundedAnswer({
      query: 'quasars sonnets and sourdough',
      selectedHex,
      selectedType: 'adu',
    })

    expect(answer.status).toBe('no-result')
    expect(answer.title).toBe('No grounded answer found')
    expect(answer.sourceCheckLabel).toBe('No matching local source')
    expect(answer.citations).toEqual([])
    expect(answer.sections[0]?.citationIds).toEqual([])
  })
})
