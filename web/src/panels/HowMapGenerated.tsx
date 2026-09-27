import { useEffect, useId, useRef } from 'react'
import type { SourceRecord } from '../data/types'
import { SourceCatalog } from './SourceCatalog'

interface HowMapGeneratedProps {
  sources: readonly SourceRecord[]
  onClose: () => void
}

const PIPELINE_STEPS = [
  {
    title: 'Fetch',
    detail:
      'Pinned public datasets are downloaded into a raw cache. Each source records its URL, vintage, license, and retrieval date.',
  },
  {
    title: 'Join & score',
    detail:
      'Parcels are assigned to tracts and municipalities. Need, Fit, and Allowed are computed with fixed thresholds—never blended into one opaque score.',
  },
  {
    title: 'Export snapshot',
    detail:
      'The browser loads only static JSON, GeoJSON, and parcel vector tiles. No public API is called at runtime, so the demo cannot time out on a live feed.',
  },
] as const

const VISUAL_LAYERS = [
  {
    title: 'Zoom changes the geography',
    detail:
      'Far out: municipalities and Pittsburgh neighborhoods summarize the share of underlying sites. Mid zoom: Census tracts. Close in: individual parcels from vector tiles.',
  },
  {
    title: 'Color is a decision status',
    detail:
      'Match view colors Ready match, Needs approval, Blocked by zoning, and related outcomes. Need view colors only the household-gap band. A street basemap keeps places recognizable.',
  },
  {
    title: 'Optional overlays',
    detail:
      'FEMA flood zones, PRT transit stops, and Pittsburgh zoning districts can be toggled without changing the underlying scores.',
  },
] as const

const BENEFITS = [
  'See where local need, site fit, and zoning disagree—so the policy lever is clear.',
  'Spot “Blocked by zoning” places: needed housing that today’s code does not allow.',
  'Keep values separate from facts: priority sliders reorder scenarios; they never rewrite household data or flood maps.',
  'Trace every number back to a published source and vintage in the snapshot.',
  'Share a view link so colleagues land on the same place, housing type, and map mode.',
] as const

const GAPS = [
  'Zoning allowance is computed only inside Pittsburgh; elsewhere it shows as unknown until a municipal code matrix is added and reviewed.',
  'Pittsburgh zoning matrix rows stay labeled draft until a person verifies each code citation.',
  'HUD CHAS income-banded cost burden is optional; without it, the map falls back to ACS rent-burden shares.',
  'Steep-slope exclusions use the City layer only; countywide slope coverage is incomplete.',
  'Sewer and water capacity, parcel ownership, and willingness to sell are not in the data.',
  'Subsidized-unit inventories, vehicle-miles, and service proximity (grocery, clinic) are not fully wired yet.',
  'Household preferences and community priorities require engagement—this map cannot substitute for that.',
] as const

export function HowMapGenerated({ sources, onClose }: HowMapGeneratedProps) {
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div
      className="how-map-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <aside
        id="how-map-generated"
        className="how-map"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <header className="how-map__header">
          <div>
            <p className="eyebrow">Transparency</p>
            <h2 id={headingId}>How was this map generated?</h2>
            <p className="how-map__lede">
              Public data is fetched offline, scored with a deterministic Need
              → Fit → Allowed model, then drawn on recognizable boundaries over
              a street basemap.
            </p>
          </div>
          <button
            ref={closeRef}
            className="how-map__close"
            type="button"
            aria-label="Close how this map was generated"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="how-map__body">
          <section className="how-map__section" aria-labelledby="how-sources">
            <h3 id="how-sources">Sources used</h3>
            <p>
              Every layer comes from the hackathon public-data catalog or a
              linked open dataset. Owner names and mailing addresses from
              assessments are never retained past the raw download.
            </p>
            <SourceCatalog
              sources={sources}
              heading="Sources in this snapshot"
              id="how-map-sources"
            />
          </section>

          <section className="how-map__section" aria-labelledby="how-pipeline">
            <h3 id="how-pipeline">Data pipeline strategy</h3>
            <p>
              Scoring runs once in Python and ships a versioned snapshot. The
              web app only reads those files, so results stay reproducible and
              offline-friendly.
            </p>
            <ol className="how-map__steps">
              {PIPELINE_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="how-map__step-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="how-map__section" aria-labelledby="how-visual">
            <h3 id="how-visual">How it is represented visually</h3>
            <ul className="how-map__cards">
              {VISUAL_LAYERS.map((layer) => (
                <li key={layer.title}>
                  <strong>{layer.title}</strong>
                  <p>{layer.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="how-map__section" aria-labelledby="how-benefits">
            <h3 id="how-benefits">Benefits for users</h3>
            <ul className="how-map__list">
              {BENEFITS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="how-map__section" aria-labelledby="how-gaps">
            <h3 id="how-gaps">What is still missing</h3>
            <p>
              Gaps are shown as unknown or not available rather than filled in.
              Closing them would make screening sharper:
            </p>
            <ul className="how-map__list">
              {GAPS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  )
}
