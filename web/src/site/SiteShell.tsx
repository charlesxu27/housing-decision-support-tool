import { useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const REPOSITORY_URL =
  'https://github.com/charlesxu27/housing-decision-support-tool'

function NavigationLinks() {
  return (
    <>
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/map">Explore map</NavLink>
      <NavLink to="/about">About</NavLink>
      <NavLink to="/contact">Contact</NavLink>
    </>
  )
}

export function SiteShell() {
  const mobileNavigation = useRef<HTMLDetailsElement>(null)

  return (
    <div className="site-shell">
      <header className="site-header">
        <NavLink className="site-brand" to="/" aria-label="Housing Match home">
          <span className="brand-mark" aria-hidden="true">
            HM
          </span>
          <span>
            <strong>Allegheny Housing Match</strong>
            <small>Planning conversation starter</small>
          </span>
        </NavLink>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavigationLinks />
          <NavLink className="button button-small" to="/plan">
            Start planning
          </NavLink>
        </nav>

        <details className="mobile-nav" ref={mobileNavigation}>
          <summary aria-label="Open navigation">Menu</summary>
          <nav
            aria-label="Mobile navigation"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) {
                mobileNavigation.current?.removeAttribute('open')
              }
            }}
          >
            <NavigationLinks />
            <NavLink className="button button-small" to="/plan">
              Start planning
            </NavLink>
          </nav>
        </details>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div>
          <strong>Allegheny Housing Match</strong>
          <p>
            An open-source decision-support prototype using illustrative fixture
            data—not legal, zoning, financial, engineering, permitting, or final
            planning advice.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <NavLink to="/about">Method & limitations</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          <a href={REPOSITORY_URL} rel="noreferrer" target="_blank">
            GitHub repository
          </a>
        </nav>
      </footer>
    </div>
  )
}
