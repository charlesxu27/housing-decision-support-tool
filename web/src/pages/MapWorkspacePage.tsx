import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PlanningCopilot } from '../copilot/PlanningCopilot'
import { DataState } from '../data/DataState'
import type { Snapshot } from '../data/load'
import { useSnapshot } from '../data/useSnapshot'
import { dataVintageLabel } from '../data/vintage'
import {
  TYPE_IDS,
  type AreaRecord,
  type ParcelTileProperties,
  type TypeId,
} from '../data/types'
import { Legend } from '../map/Legend'
import { MapView, type MapFocus } from '../map/MapView'
import {
  areaLabel,
  areaStatus,
  heaviestMember,
  summariesForArea,
} from '../model/area'
import {
  BALANCED_WEIGHTS,
  buildScenarios,
  rankScenarios,
  type ScenarioDefinition,
  type ValueWeights as ModelValueWeights,
} from '../model/scenarios'
import { ParcelCard } from '../panels/ParcelCard'
import { PlaceReport, type HousingTypeRow } from '../panels/PlaceReport'
import {
  ScenarioBuilder,
  type ScenarioScorecard,
  type ValueWeights,
} from '../panels/ScenarioBuilder'
import { Toolbar } from '../panels/Toolbar'
import { WhyThisColor } from '../panels/WhyThisColor'
import { usePlanningStore } from '../planning/store'
import { TYPE_LABELS } from '../shared/labels'
import {
  parseMapConfiguration,
  toMapSearch,
  type MapConfiguration,
  type MapMode,
} from '../shared/mapState'
import { DecisionRibbon, MethodStory } from '../story'

const TARGET_HOMES = 40

function toModelWeights(weights: ValueWeights): ModelValueWeights {
  return {
    protectResidents: weights.protectResidents,
    lowCarbon: weights.lowCarbon,
    climateSafety: weights.climateSafety,
    deepAffordability: weights.deepAffordability,
    speedToBuild: weights.speedToBuild,
  }
}

function scenarioCards(
  scenarios: readonly ScenarioDefinition[],
  weights: ValueWeights,
): ScenarioScorecard[] {
  const scores = new Map(
    rankScenarios(scenarios, toModelWeights(weights)).map((result) => [
      result.scenarioId,
      result.score / 100,
    ]),
  )

  return scenarios.map((scenario) => {
    const homes = Object.values(scenario.mix).reduce(
      (sum, count) => sum + (count ?? 0),
      0,
    )
    const { facts } = scenario
    const zoningEase =
      homes === 0
        ? 0
        : Math.min(
            1,
            (facts.homesByRight + facts.homesNeedApproval * 0.55) / homes,
          )
    const factLines = [
      `${facts.homesByRight} homes by right · ${facts.homesNeedApproval} need approval · ${facts.homesNeedRezoning} need rezoning · ${facts.homesZoningUnknown} zoning unknown`,
      `${facts.suitableParcels} suitable parcels for about ${facts.parcelsRequired} required`,
      `${facts.climateExposedHomes} homes in a flood zone · about ${facts.estimatedDeliveryMonths} months to deliver (assumption)`,
      `Embodied carbon ${facts.carbonKgCo2ePerHome[0].toLocaleString()}–${facts.carbonKgCo2ePerHome[1].toLocaleString()} kg CO2e per home (assumption)`,
    ]

    return {
      id: scenario.id,
      label: scenario.name,
      description: scenario.description,
      homes,
      householdsServed: facts.householdsServedShare,
      landFit: Math.min(1, facts.suitableParcels / Math.max(1, facts.parcelsRequired)),
      zoningEase,
      displacementSafety: scenario.valueScores.protectResidents,
      carbon: scenario.valueScores.lowCarbon,
      climate: scenario.valueScores.climateSafety,
      speed: scenario.valueScores.speedToBuild,
      score: scores.get(scenario.id) ?? 0,
      facts: factLines,
      unavailable: scenario.unavailable,
    }
  })
}

function zoningNote(area: AreaRecord, zoningDraft: boolean): string {
  if (!area.inCity) {
    return `Zoning for ${area.muni} is not in the snapshot. Allowed is computed only inside Pittsburgh; verify with the municipality.`
  }
  return zoningDraft
    ? 'Pittsburgh zoning matrix is draft and not human-verified. Confirm the code section before relying on it.'
    : 'Pittsburgh zoning matrix rows are human-verified; confirm overlays and lot conditions before acting.'
}

function buildUnknowns(
  area: AreaRecord,
  zoningDraft: boolean,
  sourcesUnavailable: string[],
): string[] {
  const items: string[] = []
  if (!area.inCity) {
    items.push(
      `Zoning for ${area.muni} is unknown: Allowed is computed only inside the City of Pittsburgh.`,
    )
  } else if (zoningDraft) {
    items.push(
      'Pittsburgh zoning statuses come from a draft matrix that has not been human-verified.',
    )
  }
  if (area.risk.slopeShare == null) {
    items.push('Steep-slope coverage is not available outside the City slope layer.')
  }
  if (area.risk.undermined == null) {
    items.push('Undermined-area coverage is not available for this tract.')
  }
  if (area.risk.displacement == null) {
    items.push(
      'Displacement index is not available because renter share, cost burden, or median income was not published.',
    )
  }
  if (area.households.cost_burdened_renters == null) {
    items.push('Cost-burdened renter share was not published for this tract.')
  }
  if (area.carbon.vmtPerHh == null) {
    items.push('Vehicle miles per household is not wired to a source yet.')
  }
  const nullMeasures = [
    ...Object.entries(area.households),
    ...Object.entries(area.stock),
  ].filter(([, value]) => value == null).length
  if (nullMeasures > 0) {
    items.push(
      `${nullMeasures} household or stock measure${nullMeasures === 1 ? ' is' : 's are'} not available from ACS for this tract.`,
    )
  }
  if (area.moeFlags.length > 0) {
    items.push(
      `${area.moeFlags.length} estimate${area.moeFlags.length === 1 ? ' has' : 's have'} a high margin of error: ${area.moeFlags.join(', ')}.`,
    )
  }
  for (const title of sourcesUnavailable) {
    items.push(`${title} was not available when this snapshot was built.`)
  }
  items.push(
    'Sewer and water capacity are not included.',
    'Parcel ownership and willingness to sell are unknown.',
    'Household preferences require community engagement.',
  )
  return items
}

interface WorkspaceProps {
  snapshot: Snapshot
}

function Workspace({ snapshot }: WorkspaceProps) {
  const { areas, areasById, summaries, manifest, zoningMatrix, lookupAllowed } = snapshot
  const zoningDraft = zoningMatrix.verificationStatus === 'draft'
  const dataVintage = dataVintageLabel(manifest)
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialConfiguration] = useState(() =>
    parseMapConfiguration(searchParams.toString(), areas),
  )
  const handoff = usePlanningStore((state) => state.handoff)
  const initialHandoff =
    handoff?.configuration.place === initialConfiguration.place &&
    handoff.configuration.type === initialConfiguration.type
      ? handoff
      : null

  const [selectedId, setSelectedId] = useState(initialConfiguration.place)
  const [selectedType, setSelectedType] = useState<TypeId>(initialConfiguration.type)
  const [mode, setMode] = useState<MapMode>(initialConfiguration.view)
  const [is3d, setIs3d] = useState(initialConfiguration.dimension === '3d')
  const [copied, setCopied] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [selectedParcel, setSelectedParcel] = useState<ParcelTileProperties | null>(null)
  const [focus, setFocus] = useState<MapFocus>({ version: 0, bbox: null })
  const [weights, setWeights] = useState<ValueWeights>(
    initialHandoff?.weights ?? {
      protectResidents: BALANCED_WEIGHTS.protectResidents * 50,
      lowCarbon: BALANCED_WEIGHTS.lowCarbon * 50,
      climateSafety: BALANCED_WEIGHTS.climateSafety * 50,
      deepAffordability: BALANCED_WEIGHTS.deepAffordability * 50,
      speedToBuild: BALANCED_WEIGHTS.speedToBuild * 50,
    },
  )

  const selected = areasById.get(selectedId) ?? areas[0]
  const matchingHandoff =
    handoff?.configuration.place === selected.id &&
    handoff.configuration.type === selectedType
      ? handoff
      : null

  useEffect(() => {
    const configuration: MapConfiguration = {
      place: selected.id,
      type: selectedType,
      view: mode,
      dimension: is3d ? '3d' : '2d',
    }
    setSearchParams(new URLSearchParams(toMapSearch(configuration)), {
      replace: true,
    })
  }, [is3d, mode, selected.id, selectedType, setSearchParams])

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

  const selectedSummaries = useMemo(
    () => summariesForArea(selected, summaries),
    [selected, summaries],
  )
  const selectedSummary =
    selectedSummaries.find((summary) => summary.kind === 'neighborhood') ??
    selectedSummaries[0] ??
    null

  const rows = useMemo<HousingTypeRow[]>(
    () =>
      TYPE_IDS.map((type) => ({
        id: type,
        label: TYPE_LABELS[type],
        need: selected.need[type],
        fit: selected.fit[type].band,
        allowed: selected.allowed[type],
        status: areaStatus(selected, type),
        parcels: selected.fit[type].parcels,
        homes: selected.fit[type].homes,
        zoningNote: zoningNote(selected, zoningDraft),
      })),
    [selected, zoningDraft],
  )

  const unknowns = useMemo(
    () =>
      buildUnknowns(
        selected,
        zoningDraft,
        manifest.sources.filter((source) => !source.available).map((source) => source.title),
      ),
    [manifest.sources, selected, zoningDraft],
  )

  const scenarios = useMemo(() => buildScenarios(selected, TARGET_HOMES), [selected])

  const copyViewLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const selectArea = (id: string) => {
    if (!areasById.has(id)) return
    setSelectedId(id)
  }

  return (
    <>
      <WorkspaceHeader>
        <button
          className="button button-secondary"
          type="button"
          aria-controls="planning-copilot-drawer"
          aria-expanded={copilotOpen}
          onClick={() => setCopilotOpen(true)}
        >
          ✦ Ask the map
        </button>
        <button className="button button-secondary" type="button" onClick={copyViewLink}>
          {copied ? 'Link copied' : 'Share this view'}
        </button>
        <span className="data-vintage-pill">Data: {dataVintage}</span>
      </WorkspaceHeader>

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
        summaries={summaries}
        selectedSummaryId={selectedSummary?.id ?? null}
        selectedLabel={areaLabel(selected)}
        onSummaryChange={(summary) => {
          const tract = heaviestMember(summary, areasById)
          if (!tract) return
          setSelectedId(tract.id)
          setSelectedParcel(null)
          setFocus((current) => ({ version: current.version + 1, bbox: summary.bbox }))
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
        placeName={areaLabel(selected)}
        typeLabel={TYPE_LABELS[selectedType]}
        need={selected.need[selectedType]}
        fit={selected.fit[selectedType].band}
        allowed={selected.allowed[selectedType]}
        action={areaStatus(selected, selectedType)}
      />

      <section className="map-panel workspace-map">
        <MapView
          snapshot={snapshot}
          selected={selected}
          type={selectedType}
          mode={mode}
          is3d={is3d}
          focus={focus}
          onSelectArea={(id) => {
            selectArea(id)
            setSelectedParcel(null)
            setExplanationOpen(true)
          }}
          selectedPin={selectedParcel?.pin ?? null}
          onSelectParcel={(parcel) => {
            setSelectedParcel(parcel)
            setExplanationOpen(false)
          }}
        />
        <Legend mode={mode} />
        {selectedParcel ? (
          <ParcelCard
            parcel={selectedParcel}
            area={areasById.get(selectedParcel.tract)}
            type={selectedType}
            typeLabel={TYPE_LABELS[selectedType]}
            mode={mode}
            lookupAllowed={lookupAllowed}
            zoningMatrix={zoningMatrix}
            zoningDraft={zoningDraft}
            sources={manifest.sources}
            onClose={() => setSelectedParcel(null)}
          />
        ) : explanationOpen ? (
          <WhyThisColor
            area={selected}
            placeName={areaLabel(selected)}
            type={selectedType}
            typeLabel={TYPE_LABELS[selectedType]}
            mode={mode}
            zoningDraft={zoningDraft}
            sources={manifest.sources}
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
              area={selected}
              selectedTypeLabel={TYPE_LABELS[selectedType]}
              rows={rows}
              unknowns={unknowns}
              sources={manifest.sources}
              dataVintage={dataVintage}
            />
          </div>
        </details>

        <details>
          <summary>
            <span>
              <small>Your values</small>
              Compare {TARGET_HOMES}-home scenarios for this tract
            </span>
            <strong>Open scenarios</strong>
          </summary>
          <ScenarioBuilder
            placeName={selected.name}
            targetHomes={TARGET_HOMES}
            scenarios={scenarioCards(scenarios, weights)}
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
        financial, engineering, permitting, or final planning advice. Values
        come from the public data snapshot ({dataVintage}); Allowed is
        computed only inside Pittsburgh
        {zoningDraft ? ' from a draft zoning matrix' : ''}. Verify
        authoritative sources and engage affected communities before acting.
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
              selectedArea={selected}
              selectedType={selectedType}
              matchStatus={areaStatus(selected, selectedType)}
              zoningDraft={zoningDraft}
              dataVintage={dataVintage}
            />
          </aside>
        </div>
      ) : null}
    </>
  )
}

function WorkspaceHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="workspace-heading">
      <div>
        <p className="page-kicker">Interactive prototype workspace</p>
        <h1>Housing match map</h1>
        <p>
          Inspect the core map first, then open reports, scenarios, and method
          details as needed.
        </p>
      </div>
      {children ? <div className="workspace-actions">{children}</div> : null}
    </header>
  )
}

export function MapWorkspacePage() {
  const state = useSnapshot()

  return (
    <main className="workspace-page">
      {state.status === 'ready' && state.snapshot ? (
        <Workspace snapshot={state.snapshot} />
      ) : (
        <>
          <WorkspaceHeader />
          <DataState state={state} subject="the map workspace" />
        </>
      )}
    </main>
  )
}
