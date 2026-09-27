import { describe, expect, it } from 'vitest'
import { allowanceSentence, describeDistrict, districtHoverText } from './zoningGlossary'

describe('zoning district glossary', () => {
  it('expands the acronyms that show up on a mixed riverfront tract', () => {
    expect(describeDistrict('GI')).toMatchObject({
      name: 'General industrial',
    })
    expect(describeDistrict('R1A-VH').name).toBe(
      'Single-unit attached residential, very high density',
    )
    expect(describeDistrict('RIV-RM').name).toBe('Riverfront, mixed residential')
    expect(describeDistrict('gi').name).toBe('General industrial')
  })

  it('states whether the selected housing type can be built', () => {
    expect(allowanceSentence('Duplex / triplex', 'not_permitted')).toContain(
      'not permitted',
    )
    expect(
      districtHoverText('GI', {
        typeLabel: 'Duplex / triplex',
        status: 'not_permitted',
      }),
    ).toContain('General industrial')
    expect(
      districtHoverText('GI', {
        typeLabel: 'Duplex / triplex',
        status: 'not_permitted',
      }),
    ).toContain('not permitted')
  })
})
