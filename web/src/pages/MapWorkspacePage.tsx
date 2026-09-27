import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PlanningCopilot } from '../copilot/PlanningCopilot'
import { ILLUSTRATIVE_HEXES } from '../data/fixtures'
import { TYPE_IDS, type HexRecord, type TypeId } from '../data/types'
import { Legend } from '../map/Legend'
import { MapView, type MapMode } from '../map/MapView'
import { deriveMatchStatus } from '../model/match'
import {
  BALANCED_WEIGHTS,
  SCENARIOS,
  rankScenarios,
  type ValueWeights as ModelValueWeights,
} from '../model/scenarios'
import {
  PlaceReport,
  type HousingTypeRow,
} from '../panels/PlaceReport'
import {
  ScenarioBuilder,
  type ScenarioScorecard,
  type ValueWeights,
} from '../panels/ScenarioBuilder'
import { Toolbar } from '../panels/Toolbar'
import { WhyThisColor } from '../panels/WhyThisColor'
import { usePlanningStore } from '../planning/store'
import { STATUS_LABELS, TYPE_LABELS } from '../shared/labels'
import {
  parseMapConfiguration,
  toMapSearch,
  type MapConfiguration,
} from '../shared/mapState'
import { DecisionRibbon, MethodStory } from '../story'

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

export function MapWorkspacePage() {
  const cells = useMemo<ViewCell[]>(
    () => ILLUSTRATIVE_HEXES.map((cell) => ({ ...cell, name: cellName(cell) })),
    [],
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialConfiguration] = useState(() =>
    parseMapConfiguration(searchParams.toString(), cells),
  )
  const handoff = usePlanningStore((state) => state.handoff)
  const initialHandoff =
    handoff?.configuration.place === initialConfiguration.place &&
    handoff.configuration.type === initialConfiguration.type
      ? handoff
      : null

  const [selectedH3, setSelectedH3] = useState(initialConfiguration.place)
  const [selectedType, setSelectedType] = useState<TypeId>(
    initialConfiguration.type,
  )
  const [mode, setMode] = useState<MapMode>(initialConfiguration.view)
  const [is3d, setIs3d] = useState(initialConfiguration.dimension === '3d')
  const [copied, setCopied] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [mapFocusVersion, setMapFocusVersion] = useState(0)
  const [weights, setWeights] = useState<ValueWeights>(
    initialHandoff?.weights ?? {
      protectResidents: BALANCED_WEIGHTS.protectResidents * 50,
      lowCarbon: BALANCED_WEIGHTS.lowCarbon * 50,
      climateSafety: BALANCED_WEIGHTS.climateSafety * 50,
      deepAffordability: BALANCED_WEIGHTS.deepAffordability * 50,
      speedToBuild: BALANCED_WEIGHTS.speedToBuild * 50,
    },
  )

  const selected =
    cells.find((cell) => cell.h3 === selectedH3) ?? cells[0]
  const matchingHandoff =
    handoff?.configuration.place === selectedH3 &&
    handoff.configuration.type === selectedType
      ? handoff
      : null

  useEffect(() => {
    const configuration: MapConfiguration = {
      place: selectedH3,
      type: selectedType,
      view: mode,
      dimension: is3d ? '3d' : '2d',
    }
    setSearchParams(new URLSearchParams(toMapSearch(configuration)), {
      replace: true,
    })
  }, [is3d, mode, selectedH3, selectedType, setSearchParams])

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
      return `${TYPE_LABELS[selectedType]}: ${STATUS_LABELS[status]}. ${fit.parcels} illustrative suitable parcels.\nClick to see why.`
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
    items.unshift(
      selected.inCity
        ? 'Pittsburgh zoning values are illustrative until the code matrix is human-verified.'
        : `Zoning for ${selected.muni} has not been loaded or human-verified.`,
    )
    if (selected.moeFlags.length > 0) {
      items.push(
        'One or more household estimates have high uncertainty in this fixture.',
      )
    }
    return items
  }, [selected])

  const copyViewLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="page-kicker">Interactive prototype workspace</p>
          <h1>Housing match map</h1>
          <p>
            Inspect the core map first, then open reports, scenarios, and method
            details as needed.
          </p>
        </div>
        <div className="workspace-actions">
          <button
            className="button button-secondary"
            type="button"
            aria-controls="planning-copilot-drawer"
            aria-expanded={copilotOpen}
            onClick={() => setCopilotOpen(true)}
          >
            ✦ Ask the map
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={copyViewLink}
          >
            {copied ? 'Link copied' : 'Share this view'}
          </button>
          <span className="prototype-pill">Fixture data</span>
        </div>
      </header>

      {matchingHandoff ? (
        <section className="planning-context" aria-label="Planning context">
          <div>
            <p className="page-kicker">Your planning lens</p>
            <p>{matchingHandoff.summary}</p>
            {matchingHandoff.answers.context ? (
              <small>Context: {matchingHandoff.answers.context}</small>
            ) : null}
            {matchingHandoff.answers.tradeoff ? (
              <small>Tradeoff to watch: {matchingHandoff.answers.tradeoff}</small>
            ) : null}
          </div>
          <Link to="/plan">Adjust answers</Link>
        </section>
      ) : (
        <section className="planning-context planning-context-quiet">
          <p>
            Want a guided starting point?{' '}
            <Link to="/plan">Configure this map with the planning wizard.</Link>
          </p>
        </section>
      )}

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

      <section className="map-panel workspace-map">
        <MapView
          key={`${mapFocusVersion}-${is3d ? '3d' : '2d'}`}
          cells={cells}
          selected={selected}
          mode={mode}
          is3d={is3d}
          getStatus={getStatus}
          getNeed={getNeed}
          getTooltip={getTooltip}
          onSelect={(cell) => {
            setSelectedH3(cell.h3)
            setExplanationOpen(true)
          }}
        />
        <Legend mode={mode} />
        {explanationOpen ? (
          <WhyThisColor
            cell={selected}
            placeName={selected.name}
            type={selectedType}
            typeLabel={TYPE_LABELS[selectedType]}
            mode={mode}
            onClose={() => setExplanationOpen(false)}
          />
        ) : null}
      </section>

      <section className="workspace-details" aria-label="Detailed analysis">
        <details>
          <summary>
            <span>
              <small>Selected place</small>
              Place report and all housing types
            </span>
            <strong>Open report</strong>
          </summary>
          <div className="report-panel">
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
          </div>
        </details>

        <details>
          <summary>
            <span>
              <small>Your values</small>
              Compare illustrative 40-home scenarios
            </span>
            <strong>Open scenarios</strong>
          </summary>
          <ScenarioBuilder
            placeName={selected.name}
            scenarios={scenarioCards(weights)}
            weights={weights}
            onWeightChange={(key, value) =>
              setWeights((current) => ({ ...current, [key]: value }))
            }
          />
        </details>

        <details>
          <summary>
            <span>
              <small>Transparency</small>
              Read the Need → Fit → Allowed method
            </span>
            <strong>Open method</strong>
          </summary>
          <MethodStory />
        </details>
      </section>

      <p className="disclaimer">
        <strong>Decision-support prototype.</strong> Not legal, zoning,
        financial, engineering, permitting, or final planning advice. All values
        currently shown are illustrative fixtures for testing the product
        workflow. Verify authoritative sources and engage affected communities
        before acting.
      </p>

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
    </main>
  )
}
