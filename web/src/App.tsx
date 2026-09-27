import { useCallback, useEffect, useMemo, useState } from 'react'
import { ILLUSTRATIVE_HEXES } from './data/fixtures'
import { TYPE_IDS, type HexRecord, type TypeId } from './data/types'
import { PlanningCopilot } from './copilot/PlanningCopilot'
import { Legend } from './map/Legend'
import { MapView, type MapMode } from './map/MapView'
import { deriveMatchStatus } from './model/match'
import {
  BALANCED_WEIGHTS,
  SCENARIOS,
  rankScenarios,
  type ValueWeights as ModelValueWeights,
} from './model/scenarios'
import {
  PlaceReport,
  type HousingTypeRow,
} from './panels/PlaceReport'
import {
  ScenarioBuilder,
  type ScenarioScorecard,
  type ValueWeights,
} from './panels/ScenarioBuilder'
import { Toolbar } from './panels/Toolbar'
import { DecisionRibbon, MethodStory } from './story'
import './styles.css'

const TYPE_LABELS: Record<TypeId, string> = {
  adu: 'Accessory dwelling unit (ADU)',
  duplex_triplex: 'Duplex / triplex',
  townhome: 'Townhomes / rowhouses',
  small_apartment: 'Small apartment building',
  large_apartment: 'Mid-size / large apartments',
  senior_accessible: 'Senior / accessible housing',
  rehab_reuse: 'Rehab & reuse of vacant homes',
  detached_sf: 'Detached single-family',
}

const STATUS_LABELS: Record<string, string> = {
  ready_match: 'Ready match',
  needs_approval: 'Needs approval',
  blocked_by_zoning: 'Blocked by zoning',
  needed_but_hard: 'Needed but hard',
  low_priority: 'Low priority',
  zoning_unknown: 'Zoning unknown',
  not_recommended: 'Not recommended',
  insufficient_data: 'Insufficient data',
}

type ViewCell = HexRecord & { name: string }

function cellName(cell: HexRecord) {
  return cell.neighborhood ?? cell.muni
}

function statusFor(cell: HexRecord, type: TypeId) {
  return deriveMatchStatus({
    need: cell.need[type],
    fit: cell.fit[type].band,
    allowed: cell.allowed[type],
    floodway: cell.risk.floodway,
  })
}

function toModelWeights(weights: ValueWeights): ModelValueWeights {
  return {
    protectResidents: weights.protectResidents,
    lowCarbon: weights.lowCarbon,
    climateSafety: weights.climateSafety,
    deepAffordability: weights.deepAffordability,
    speedToBuild: weights.speedToBuild,
  }
}

function scenarioCards(weights: ValueWeights): ScenarioScorecard[] {
  const scores = new Map(
    rankScenarios(SCENARIOS, toModelWeights(weights)).map((result) => [
      result.scenarioId,
      result.score / 100,
    ]),
  )

  return SCENARIOS.map((scenario) => {
    const homes = Object.values(scenario.mix).reduce(
      (sum, count) => sum + (count ?? 0),
      0,
    )
    const zoningEase =
      homes === 0
        ? 0
        : Math.min(
            1,
            (scenario.facts.homesByRight +
              scenario.facts.homesNeedApproval * 0.55) /
              homes,
          )

    return {
      id: scenario.id,
      label: scenario.name,
      description: scenario.description,
      homes,
      householdsServed: scenario.facts.householdsServedShare,
      landFit: Math.min(
        1,
        scenario.facts.suitableParcels /
          Math.max(1, scenario.facts.parcelsRequired),
      ),
      zoningEase,
      displacementSafety: 1 - scenario.facts.displacementPressure,
      carbon: scenario.valueScores.lowCarbon,
      climate: scenario.valueScores.climateSafety,
      speed: scenario.valueScores.speedToBuild,
      score: scores.get(scenario.id) ?? 0,
    }
  })
}

function App() {
  const cells = useMemo<ViewCell[]>(
    () => ILLUSTRATIVE_HEXES.map((cell) => ({ ...cell, name: cellName(cell) })),
    [],
  )
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [selectedH3, setSelectedH3] = useState(() => {
    const requested = params.get('place')
    return cells.some((cell) => cell.h3 === requested)
      ? (requested as string)
      : cells[0].h3
  })
  const [selectedType, setSelectedType] = useState<TypeId>(() => {
    const requested = params.get('type')
    return TYPE_IDS.includes(requested as TypeId)
      ? (requested as TypeId)
      : 'duplex_triplex'
  })
  const [mode, setMode] = useState<MapMode>(() =>
    params.get('view') === 'need' ? 'need' : 'match',
  )
  const [is3d, setIs3d] = useState(() => params.get('dimension') === '3d')
  const [copied, setCopied] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [mapFocusVersion, setMapFocusVersion] = useState(0)
  const [weights, setWeights] = useState<ValueWeights>({
    protectResidents: BALANCED_WEIGHTS.protectResidents * 50,
    lowCarbon: BALANCED_WEIGHTS.lowCarbon * 50,
    climateSafety: BALANCED_WEIGHTS.climateSafety * 50,
    deepAffordability: BALANCED_WEIGHTS.deepAffordability * 50,
    speedToBuild: BALANCED_WEIGHTS.speedToBuild * 50,
  })

  const selected =
    cells.find((cell) => cell.h3 === selectedH3) ?? cells[0]

  useEffect(() => {
    const next = new URLSearchParams()
    next.set('place', selectedH3)
    next.set('type', selectedType)
    next.set('view', mode)
    next.set('dimension', is3d ? '3d' : '2d')
    window.history.replaceState(null, '', `${window.location.pathname}?${next}`)
  }, [is3d, mode, selectedH3, selectedType])

  useEffect(() => {
    if (!copilotOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCopilotOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [copilotOpen])

  const getStatus = useCallback(
    (cell: ViewCell) => statusFor(cell, selectedType),
    [selectedType],
  )
  const getNeed = useCallback(
    (cell: ViewCell) => cell.need[selectedType],
    [selectedType],
  )
  const getTooltip = useCallback(
    (cell: ViewCell) => {
      const status = statusFor(cell, selectedType)
      const fit = cell.fit[selectedType]
      return `${TYPE_LABELS[selectedType]}: ${STATUS_LABELS[status]}. ${fit.parcels} illustrative suitable parcels.`
    },
    [selectedType],
  )

  const rows = useMemo<HousingTypeRow[]>(
    () =>
      TYPE_IDS.map((type) => ({
        id: type,
        label: TYPE_LABELS[type],
        need: selected.need[type],
        fit: selected.fit[type].band,
        allowed: selected.allowed[type],
        status: statusFor(selected, type),
        parcels: selected.fit[type].parcels,
        homes: selected.fit[type].homes,
        zoningNote: selected.inCity
          ? 'Illustrative MVP allowance. Exact zoning section is not yet verified.'
          : 'Zoning is not available in the fixture dataset. Verify with the municipality.',
      })),
    [selected],
  )

  const unknowns = useMemo(() => {
    const items = [
      'Sewer and water capacity are not included.',
      'Parcel ownership and willingness to sell are unknown.',
      'Household preferences require community engagement.',
    ]
    if (!selected.inCity) {
      items.unshift(
        `Zoning for ${selected.muni} has not been loaded or human-verified.`,
      )
    } else {
      items.unshift(
        'Pittsburgh zoning values are illustrative until the code matrix is human-verified.',
      )
    }
    if (selected.moeFlags.length > 0) {
      items.push(
        'One or more household estimates have high uncertainty in this fixture.',
      )
    }
    return items
  }, [selected])

  const handleWeightChange = (
    key: keyof ValueWeights,
    value: number,
  ) => {
    setWeights((current) => ({ ...current, [key]: value }))
  }

  const copyViewLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            HM
          </span>
          <div>
            <h1>Allegheny Housing Match Map</h1>
            <p>Need × Fit × Allowed — a planning conversation starter</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className="copilot-button"
            type="button"
            aria-controls="planning-copilot-drawer"
            aria-expanded={copilotOpen}
            onClick={() => setCopilotOpen(true)}
          >
            <span aria-hidden="true">✦</span> Ask the map
          </button>
          <button className="share-button" type="button" onClick={copyViewLink}>
            {copied ? 'Link copied' : 'Share this view'}
          </button>
          <span className="prototype-pill">Local MVP · Fixture data</span>
        </div>
      </header>

      <main className="workspace">
        <Toolbar
          places={cells.map((cell) => ({
            value: cell.h3,
            label: `${cell.name} · ${cell.muni}`,
          }))}
          place={selectedH3}
          onPlaceChange={(h3) => {
            setSelectedH3(h3)
            setMapFocusVersion((version) => version + 1)
          }}
          types={TYPE_IDS.map((type) => ({
            value: type,
            label: TYPE_LABELS[type],
          }))}
          type={selectedType}
          onTypeChange={(value) => setSelectedType(value as TypeId)}
          mode={mode}
          onModeChange={setMode}
          is3d={is3d}
          onDimensionChange={setIs3d}
        />

        <DecisionRibbon
          placeName={selected.name}
          typeLabel={TYPE_LABELS[selectedType]}
          need={selected.need[selectedType]}
          fit={selected.fit[selectedType].band}
          allowed={selected.allowed[selectedType]}
          action={statusFor(selected, selectedType)}
        />

        <div className="primary-layout">
          <section className="map-panel">
            <MapView
              key={`${mapFocusVersion}-${is3d ? '3d' : '2d'}`}
              cells={cells}
              selected={selected}
              mode={mode}
              is3d={is3d}
              getStatus={getStatus}
              getNeed={getNeed}
              getTooltip={getTooltip}
              onSelect={(cell) => setSelectedH3(cell.h3)}
            />
            <Legend mode={mode} />
          </section>

          <aside className="report-panel">
            <PlaceReport
              name={selected.name}
              municipality={selected.muni}
              confidence={selected.confidence}
              householdSmall={selected.households.hh_1_2 ?? 0}
              stockSmall={selected.stock.br_0_1 ?? 0}
              selectedTypeLabel={TYPE_LABELS[selectedType]}
              rows={rows}
              unknowns={unknowns}
            />
          </aside>
        </div>

        <ScenarioBuilder
          placeName={selected.name}
          scenarios={scenarioCards(weights)}
          weights={weights}
          onWeightChange={handleWeightChange}
        />

        <MethodStory />

        <p className="disclaimer">
          <strong>Decision-support prototype.</strong> Not legal, zoning,
          financial, engineering, or permitting advice. All values currently
          shown are illustrative fixtures for testing the product workflow.
          Verify authoritative sources and engage affected communities before
          acting.
        </p>
      </main>

      {copilotOpen ? (
        <div
          className="copilot-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setCopilotOpen(false)
          }}
        >
          <aside
            id="planning-copilot-drawer"
            className="copilot-drawer"
            aria-label="Planning copilot"
          >
            <button
              className="copilot-close"
              type="button"
              aria-label="Close planning copilot"
              onClick={() => setCopilotOpen(false)}
            >
              ×
            </button>
            <PlanningCopilot
              selectedHex={selected}
              selectedType={selectedType}
              matchStatus={statusFor(selected, selectedType)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default App
