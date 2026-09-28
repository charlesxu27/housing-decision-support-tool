import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./map/MapView', () => ({
  MapView: () => <div aria-label="Interactive housing match map" />,
}))

vi.mock('./planning/store', () => {
  const state = {
    answers: {
      role: '',
      context: '',
      goal: '',
      place: '',
      housingTypes: [],
      priorities: {
        protectResidents: 50,
        lowCarbon: 50,
        climateSafety: 50,
        deepAffordability: 50,
        speedToBuild: 50,
      },
      tradeoff: '',
    },
    handoff: null,
    updateAnswers: vi.fn(),
    setHandoff: vi.fn(),
    reset: vi.fn(),
  }

  return {
    usePlanningStore: <T,>(selector: (value: typeof state) => T) =>
      selector(state),
  }
})

function renderRoute(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('public site routes', () => {
  it.each([
    ['/', 'See where housing need, physical fit, and today’s rules align.'],
    ['/plan', 'Build a focused map view.'],
    ['/map', 'Housing match map'],
    ['/about', 'Evidence first. Tradeoffs in the open.'],
    ['/contact', 'Questions about the project?'],
  ])('renders %s directly', (path, heading) => {
    expect(renderRoute(path)).toContain(heading)
  })

  it('renders the map workspace in its loading state before data arrives', () => {
    const markup = renderRoute('/map')
    expect(markup).toContain('Loading the map workspace')
    expect(markup).not.toMatch(/fixture|illustrative/i)
  })

  it('links the landing page to the planning wizard', () => {
    expect(renderRoute('/')).toContain('href="/plan"')
  })

  it('renders the not-found page for an unknown route', () => {
    expect(renderRoute('/missing')).toContain(
      'That route is not part of this prototype.',
    )
  })
})
