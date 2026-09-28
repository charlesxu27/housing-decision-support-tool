// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { MapViewProps } from './map/MapView'
import { buildArea, buildSummary, buildAreaMetrics, mockSnapshotFetch } from './test/builders'

vi.mock('./map/MapView', () => ({
  MapView: ({ selected, type, mode }: MapViewProps) => (
    <div aria-label="Interactive housing match map">
      map:{selected.id}:{type}:{mode}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function renderApp(path: string, fetchImpl: (input: string) => Promise<Response>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App fetchImpl={fetchImpl} />
    </MemoryRouter>,
  )
}

describe('App with a loaded snapshot', () => {
  it('renders the workspace for a deep-linked tract from a tiny valid snapshot', async () => {
    const second = buildArea({
      id: '42003141200',
      name: 'Tract 1412',
      neighborhood: 'Homewood South',
      neighborhoods: ['Homewood South'],
      households: { cost_burdened_renters: null },
      risk: { displacement: null },
    })
    const metrics = buildAreaMetrics({
      areas: [buildArea(), second],
      summaries: [
        buildSummary(),
        buildSummary({
          id: 'hood:homewood-south',
          label: 'Homewood South',
          members: [{ id: second.id, weight: 900 }],
        }),
      ],
    })
    renderApp(
      '/map?place=42003141200&type=adu&view=need',
      mockSnapshotFetch({ '/data/area_metrics.json': metrics }),
    )

    expect(screen.getByText('Loading the map workspace…')).toBeTruthy()

    const map = await screen.findByLabelText('Interactive housing match map')
    expect(map.textContent).toBe('map:42003141200:adu:need')
    expect(
      screen.getByRole('heading', { name: 'Tract 1412', level: 2 }),
    ).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Place' })).toHaveProperty(
      'value',
      'Tract 1412 · Homewood South, Pittsburgh',
    )
    expect(screen.getAllByText(/ACS 2020-2024/).length).toBeGreaterThan(0)

    const report = screen.getByRole('region', { name: 'Detailed analysis' })
    expect(within(report).getAllByText('not available').length).toBeGreaterThan(0)
    expect(
      within(report).getAllByText(/Displacement index is not available/).length,
    ).toBeGreaterThan(0)
    expect(within(report).getAllByText('Not available').length).toBeGreaterThan(0)
    expect(
      within(report).getByText(/HUD CHAS 2018-2022 tract tables was not available/),
    ).toBeTruthy()
    expect(
      within(report).getByText(/not available in this build/),
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/fixture|illustrative/i)
  })

  it('compares two tracts and re-ranks them under a value lens', async () => {
    const second = buildArea({
      id: '42003141200',
      name: 'Tract 1412',
      neighborhood: 'Homewood South',
      neighborhoods: ['Homewood South'],
      needScores: { duplex_triplex: 0.9 },
      households: { cost_burdened_renters: 0.7 },
      risk: { displacement: 0.8, floodShare: 0.02 },
    })
    const metrics = buildAreaMetrics({
      areas: [
        buildArea({
          risk: { displacement: 0.2, floodShare: 0.4 },
          needScores: { duplex_triplex: 0.3 },
        }),
        second,
      ],
      summaries: [
        buildSummary(),
        buildSummary({
          id: 'hood:homewood-south',
          label: 'Homewood South',
          members: [{ id: second.id, weight: 900 }],
        }),
      ],
    })
    renderApp(
      '/map?place=42003141200&type=duplex_triplex',
      mockSnapshotFetch({ '/data/area_metrics.json': metrics }),
    )

    await screen.findByLabelText('Interactive housing match map')
    fireEvent.click(screen.getByRole('button', { name: 'Add Tract 1412' }))

    const place = screen.getByRole('combobox', { name: 'Place' })
    fireEvent.click(place)
    fireEvent.click(screen.getByRole('tab', { name: /Pittsburgh neighborhoods/ }))
    fireEvent.mouseDown(screen.getByRole('option', { name: /Homewood North/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Tract 1307' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare 2 tracts' }))

    const dialog = screen.getByRole('dialog', { name: /2 tracts/ })
    expect(
      within(dialog).getByText(/Need, fit, zoning, and hazards are facts/),
    ).toBeTruthy()
    expect(within(dialog).getByText('Your values')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Residents first' }))
    expect(within(dialog).getAllByText(/Leads|Trails|Tied/).length).toBeGreaterThan(0)
  })

  it('falls back to the first loaded tract for an unknown deep link', async () => {
    renderApp('/map?place=not-a-tract', mockSnapshotFetch())

    const map = await screen.findByLabelText('Interactive housing match map')
    expect(map.textContent).toBe('map:42003130700:duplex_triplex:match')
  })

  it('renders the error state naming the failing file when fetch fails', async () => {
    renderApp(
      '/map',
      mockSnapshotFetch({ '/data/manifest.json': undefined }),
    )

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('/data/manifest.json')
    expect(alert.textContent).toContain('HTTP 404')
    expect(screen.queryByLabelText('Interactive housing match map')).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('renders the schema error for a malformed area file', async () => {
    const area = buildArea()
    const broken = {
      ...buildAreaMetrics(),
      areas: [{ ...area, need: { ...area.need, adu: 'extreme' } }],
    }
    renderApp('/map', mockSnapshotFetch({ '/data/area_metrics.json': broken }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('/data/area_metrics.json')
    expect(alert.textContent).toContain('need.adu')
  })

  it('renders the empty state when the snapshot has no tracts', async () => {
    renderApp(
      '/map',
      mockSnapshotFetch({
        '/data/area_metrics.json': buildAreaMetrics({ areas: [], summaries: [] }),
      }),
    )

    expect(await screen.findByText('The snapshot contains no tracts')).toBeTruthy()
  })
})
