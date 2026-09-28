export interface ValueWeights {
  protectResidents: number
  lowCarbon: number
  climateSafety: number
  deepAffordability: number
  speedToBuild: number
}

/** Metric values are 0..1 (higher is better) or null when an input is missing. */
export interface ScenarioScorecard {
  id: string
  label: string
  description: string
  homes: number
  householdsServed: number | null
  landFit: number | null
  zoningEase: number | null
  displacementSafety: number | null
  carbon: number | null
  climate: number | null
  speed: number | null
  score: number
  /** Points (0..100 scale) each priority adds to `score`. */
  contributions: Record<keyof ValueWeights, number>
  /** Priorities left out of the score because their input is missing. */
  excluded: (keyof ValueWeights)[]
  /** Short factual notes derived from the tract, e.g. "24 homes by right". */
  facts: string[]
  /** Reasons a metric is not available. */
  unavailable: string[]
}

interface ScenarioBuilderProps {
  placeName: string
  targetHomes: number
  scenarios: ScenarioScorecard[]
  weights: ValueWeights
  onWeightChange: (key: keyof ValueWeights, value: number) => void
}

const WEIGHT_META: {
  key: keyof ValueWeights
  label: string
  left: string
  right: string
}[] = [
  {
    key: 'protectResidents',
    label: 'Protect existing residents',
    left: 'Less',
    right: 'More',
  },
  { key: 'lowCarbon', label: 'Low carbon', left: 'Less', right: 'More' },
  {
    key: 'climateSafety',
    label: 'Climate safety',
    left: 'Less',
    right: 'More',
  },
  {
    key: 'deepAffordability',
    label: 'Deep affordability',
    left: 'Less',
    right: 'More',
  },
  {
    key: 'speedToBuild',
    label: 'Speed to build',
    left: 'Less',
    right: 'More',
  },
]

const LENSES: {
  label: string
  weights: ValueWeights
}[] = [
  {
    label: 'Balanced',
    weights: {
      protectResidents: 50,
      lowCarbon: 50,
      climateSafety: 50,
      deepAffordability: 50,
      speedToBuild: 50,
    },
  },
  {
    label: 'Residents first',
    weights: {
      protectResidents: 100,
      lowCarbon: 45,
      climateSafety: 65,
      deepAffordability: 90,
      speedToBuild: 30,
    },
  },
  {
    label: 'Climate safe',
    weights: {
      protectResidents: 60,
      lowCarbon: 95,
      climateSafety: 100,
      deepAffordability: 50,
      speedToBuild: 30,
    },
  },
  {
    label: 'Move quickly',
    weights: {
      protectResidents: 45,
      lowCarbon: 35,
      climateSafety: 55,
      deepAffordability: 40,
      speedToBuild: 100,
    },
  },
]

function metricLabel(value: number | null) {
  if (value == null) return 'Not available'
  if (value >= 0.72) return 'Strong'
  if (value >= 0.46) return 'Mixed'
  return 'Weak'
}

function priorityLabel(key: keyof ValueWeights) {
  return WEIGHT_META.find((item) => item.key === key)?.label ?? key
}

/** Points each priority could add at most: its share of the weights in play. */
function maxPoints(weights: ValueWeights, excluded: (keyof ValueWeights)[]) {
  const scored = WEIGHT_META.filter((item) => !excluded.includes(item.key))
  const total = scored.reduce((sum, item) => sum + Math.max(0, weights[item.key]), 0)
  return Object.fromEntries(
    WEIGHT_META.map((item) => [
      item.key,
      total === 0 || excluded.includes(item.key)
        ? 0
        : (Math.max(0, weights[item.key]) * 100) / total,
    ]),
  ) as Record<keyof ValueWeights, number>
}

/** One sentence naming the priority that most separates two adjacent ranks. */
function rankReason(
  scenario: ScenarioScorecard,
  neighbor: ScenarioScorecard | undefined,
  ahead: boolean,
) {
  if (!neighbor) return null
  const gap = Math.round(Math.abs(scenario.score - neighbor.score) * 100)
  if (gap === 0) return `Tied with ${neighbor.label} under these priorities.`
  const diffs = WEIGHT_META.map((item) => ({
    key: item.key,
    diff: scenario.contributions[item.key] - neighbor.contributions[item.key],
  }))
  const decisive = diffs.reduce((best, item) =>
    (ahead ? item.diff > best.diff : item.diff < best.diff) ? item : best,
  )
  const points = Math.round(Math.abs(decisive.diff))
  return ahead
    ? `Leads ${neighbor.label} by ${gap} points, mostly on ${priorityLabel(decisive.key).toLowerCase()} (+${points}).`
    : `Trails ${neighbor.label} by ${gap} points, mostly on ${priorityLabel(decisive.key).toLowerCase()} (−${points}).`
}

function ScoreBreakdown({
  scenario,
  weights,
}: {
  scenario: ScenarioScorecard
  weights: ValueWeights
}) {
  const ceiling = maxPoints(weights, scenario.excluded)
  return (
    <div className="score-breakdown">
      <p className="eyebrow">Where the points come from</p>
      <ul>
        {WEIGHT_META.map((item) => {
          const excluded = scenario.excluded.includes(item.key)
          const earned = scenario.contributions[item.key]
          const possible = ceiling[item.key]
          return (
            <li
              key={item.key}
              className={excluded ? 'score-breakdown__row--excluded' : undefined}
            >
              <span>{item.label}</span>
              <span className="score-breakdown__bar" aria-hidden="true">
                <span
                  style={{
                    width: `${possible === 0 ? 0 : Math.min(100, (earned / possible) * 100)}%`,
                  }}
                />
              </span>
              <span>
                {excluded
                  ? 'Not scored'
                  : `${Math.round(earned)} of ${Math.round(possible)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={value == null ? 'metric-unavailable' : undefined}>
      <dt>{label}</dt>
      <dd>{metricLabel(value)}</dd>
    </div>
  )
}

export function ScenarioBuilder({
  placeName,
  targetHomes,
  scenarios,
  weights,
  onWeightChange,
}: ScenarioBuilderProps) {
  const ranked = [...scenarios].sort((a, b) => b.score - a.score)

  return (
    <section className="scenario-builder" aria-labelledby="scenario-heading">
      <div className="scenario-intro">
        <div>
          <p className="eyebrow">Compare approaches</p>
          <h2 id="scenario-heading">
            {targetHomes} new homes in {placeName}
          </h2>
          <p className="muted">
            Each template uses the same assumed {targetHomes}-home target so
            its tradeoffs can be compared at an equal scale. It is a comparison
            baseline, not a recommended target for the tract. Facts come from
            this tract and stay fixed; your values change how scenarios rank.
          </p>
        </div>
        <span className="provenance user-value">Your values</span>
      </div>

      <div className="scenario-layout">
        <div className="values-panel">
          <p className="eyebrow">What should this decision prioritize?</p>
          <div className="lens-list" aria-label="Priority presets">
            {LENSES.map((lens) => (
              <button
                key={lens.label}
                type="button"
                onClick={() => {
                  for (const [key, value] of Object.entries(lens.weights)) {
                    onWeightChange(key as keyof ValueWeights, value)
                  }
                }}
              >
                {lens.label}
              </button>
            ))}
          </div>
          {WEIGHT_META.map((item) => (
            <label className="weight-control" key={item.key}>
              <span>
                {item.label}
                <output>{weights[item.key]}</output>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weights[item.key]}
                onChange={(event) =>
                  onWeightChange(item.key, Number(event.target.value))
                }
              />
              <small>
                <span>{item.left}</span>
                <span>{item.right}</span>
              </small>
            </label>
          ))}
          <p className="values-note">
            These controls express priorities. They do not alter household,
            parcel, hazard, or zoning facts.
          </p>
        </div>

        <div className="scenario-cards">
          {ranked.map((scenario, index) => (
            <article
              className={`scenario-card ${index === 0 ? 'recommended' : ''}`}
              key={scenario.id}
            >
              <div className="scenario-card-heading">
                <div>
                  <span className="scenario-rank">#{index + 1}</span>
                  <h3>{scenario.label}</h3>
                </div>
                <strong>{Math.round(scenario.score * 100)}</strong>
              </div>
              <p>{scenario.description}</p>
              <p className="score-reason">
                {index === 0
                  ? rankReason(scenario, ranked[1], true)
                  : rankReason(scenario, ranked[index - 1], false)}
              </p>
              <ScoreBreakdown scenario={scenario} weights={weights} />
              <dl>
                <Metric label="Household needs served" value={scenario.householdsServed} />
                <Metric label="Land fit" value={scenario.landFit} />
                <Metric label="Zoning path" value={scenario.zoningEase} />
                <Metric
                  label="Displacement protection"
                  value={scenario.displacementSafety}
                />
                <Metric label="Carbon (assumption)" value={scenario.carbon} />
                <Metric label="Climate safety" value={scenario.climate} />
                <Metric label="Speed" value={scenario.speed} />
              </dl>
              {scenario.facts.length > 0 ? (
                <ul className="scenario-facts">
                  {scenario.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              ) : null}
              {scenario.unavailable.length > 0 ? (
                <ul className="scenario-facts scenario-facts--unavailable">
                  {scenario.unavailable.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
