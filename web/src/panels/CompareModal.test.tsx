// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildArea } from '../test/builders'
import { buildTractProfile } from '../model/compare'
import { CompareModal } from './CompareModal'
import type { ValueWeights } from '../model/scenarios'

afterEach(() => {
  cleanup()
})

const safer = buildTractProfile(
  buildArea({
    id: '42003000001',
    name: 'Tract 0001',
    neighborhood: 'Safer Place',
    needScores: { duplex_triplex: 0.4 },
    households: { cost_burdened_renters: 0.2 },
    risk: { displacement: 0.2, floodShare: 0.4 },
    allowed: { duplex_triplex: 'not_permitted' },
  }),
  'duplex_triplex',
)

const needed = buildTractProfile(
  buildArea({
    id: '42003000002',
    name: 'Tract 0002',
    neighborhood: 'Needed Place',
    needScores: { duplex_triplex: 0.9 },
    households: { cost_burdened_renters: 0.7 },
    risk: { displacement: 0.8, floodShare: 0.02 },
    transitTrips800m: 1_800,
    allowed: { duplex_triplex: 'by_right' },
  }),
  'duplex_triplex',
)

const protectOnly: ValueWeights = {
  protectResidents: 100,
  lowCarbon: 0,
  climateSafety: 0,
  deepAffordability: 0,
  speedToBuild: 0,
}

describe('CompareModal', () => {
  it('ranks places and names the priority that separates them', () => {
    render(
      <CompareModal
        typeLabel="Duplex / triplex"
        profiles={[safer, needed]}
        weights={protectOnly}
        onWeightChange={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole('heading', { name: /2 tracts/ })).toBeTruthy()
    expect(
      screen.getByText('Leads Tract 0002 by 60 points, mostly on protect existing residents (+60).'),
    ).toBeTruthy()
    expect(screen.getAllByText('Observed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Law').length).toBeGreaterThan(0)
    expect(screen.getByText('Your values')).toBeTruthy()
    expect(
      screen.getByText(/Need, fit, zoning, and hazards are facts/),
    ).toBeTruthy()
  })

  it('lets a lens preset change the weights', () => {
    const onWeightChange = vi.fn()
    render(
      <CompareModal
        typeLabel="Duplex / triplex"
        profiles={[safer, needed]}
        weights={protectOnly}
        onWeightChange={onWeightChange}
        onClose={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Climate safe' }))
    expect(onWeightChange).toHaveBeenCalledWith('climateSafety', 100)
  })
})
