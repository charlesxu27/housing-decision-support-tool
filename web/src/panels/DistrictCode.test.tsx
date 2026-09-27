// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DistrictCodeList } from './DistrictCode'

afterEach(() => {
  cleanup()
})

describe('DistrictCode', () => {
  it('shows the district name and allowance on hover', () => {
    render(
      <DistrictCodeList
        codes={['GI', 'R2-VH']}
        type="duplex_triplex"
        typeLabel="Duplex / triplex"
        lookupAllowed={(zone) => (zone === 'GI' ? 'not_permitted' : 'by_right')}
        draft
      />,
    )

    const industrial = screen.getByRole('button', { name: /GI, General industrial/ })
    fireEvent.mouseEnter(industrial)

    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('General industrial')
    expect(tip.textContent).toContain('New housing is not the purpose')
    expect(tip.textContent).toContain('Duplex / triplex is not permitted')
    expect(tip.textContent).toContain('Draft reading')
  })
})
