// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByText(/This lot:/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /R1D-L, Single-unit detached/ }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Districts present/)).toBeNull()
    expect(screen.getByText(/Not used for this color/)).toBeTruthy()
    const decisive = document.querySelector('.why-color__check--decisive .why-color__mark')
    expect(decisive?.textContent).toBe('×')
    expect(decisive?.getAttribute('style')).toContain('rgb(52, 125, 188)')
    expect(document.querySelector('.why-color__check--skipped .why-color__mark')?.textContent).toBe('–')
    expect(screen.getByText('Median household income')).toBeTruthy()
    expect(screen.getByText('$41,200')).toBeTruthy()
    expect(screen.getByText('County median $78,548')).toBeTruthy()
    const gradeLine = (label: string) =>
      screen.getByText((_, element) => element?.tagName === 'SMALL' && element.textContent === label)
    expect(screen.getByText('Pittsburgh School District')).toBeTruthy()
    expect(gradeLine('D · 36%')).toBeTruthy()
    const levels = screen.getByText('Elementary, middle, and high').closest('details')
    expect(levels?.open).toBe(false)

    fireEvent.click(screen.getByText('Elementary, middle, and high'))
    expect(levels?.open).toBe(true)
    expect(screen.getByText('Pittsburgh Colfax K-8')).toBeTruthy()
    expect(gradeLine('B · 75%')).toBeTruthy()
    expect(screen.getByText('Pittsburgh Sterrett 6-8')).toBeTruthy()
    expect(gradeLine('C · 54%')).toBeTruthy()
    expect(gradeLine('B · 62%')).toBeTruthy()
    expect(screen.getByText('Feeder attendance zone, 88% of this tract')).toBeTruthy()
    expect(screen.getByText('Pittsburgh Allderdice HS')).toBeTruthy()
    expect(screen.queryByText(/Census median/)).toBeNull()

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'About these figures' }))
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('Census median')
    expect(tip.textContent).toContain('Future Ready PA 2024')
    expect(tip.textContent).toContain('A is 80% or higher')
    expect(tip.textContent).toContain('feeder attendance zone')
  })
})
