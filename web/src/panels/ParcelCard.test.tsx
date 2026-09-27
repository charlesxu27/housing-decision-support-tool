// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createLookupAllowed } from '../data/load'
import { buildArea, buildManifest, buildParcel, buildZoningMatrix } from '../test/builders'
import { ParcelCard } from './ParcelCard'

afterEach(() => {
  cleanup()
})

describe('ParcelCard', () => {
  it('explains why the selected lot is that color', () => {
    const matrix = buildZoningMatrix()
    render(
      <ParcelCard
        parcel={buildParcel({ lot: 4_200, f_adu: 0, zone: 'R1D-L' })}
        area={buildArea({ need: { adu: 'high' } })}
        type="adu"
        typeLabel="Accessory dwelling unit (ADU)"
        mode="match"
        lookupAllowed={createLookupAllowed(matrix)}
        zoningMatrix={matrix}
        zoningDraft
        sources={buildManifest().sources}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole('heading', { name: /Needed but hard/ })).toBeTruthy()
    expect(screen.getByText(/under the 5,000 sq ft minimum for an ADU/)).toBeTruthy()
    expect(screen.getByText(/Not used: an earlier check settled the color/)).toBeTruthy()
  })
})
