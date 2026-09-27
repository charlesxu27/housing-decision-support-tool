export interface ValueWeights {
  protectResidents: number
  lowCarbon: number
  climateSafety: number
  deepAffordability: number
  speedToBuild: number
}

export interface ScenarioScorecard {
  id: string
  label: string
  description: string
  homes: number
  householdsServed: number
  landFit: number
  zoningEase: number
  displacementSafety: number
  carbon: number
  climate: number
  speed: number
  score: number
}

interface ScenarioBuilderProps {
  placeName: string
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

function metricLabel(value: number) {
  if (value >= 0.72) return 'Strong'
  if (value >= 0.46) return 'Mixed'
  return 'Weak'
}

export function ScenarioBuilder({
  placeName,
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
          <h2 id="scenario-heading">40 new homes in {placeName}</h2>
          <p className="muted">
            Facts stay fixed. Your values change how scenarios rank.
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
              <dl>
                <div>
                  <dt>Household needs served</dt>
                  <dd>{metricLabel(scenario.householdsServed)}</dd>
                </div>
                <div>
                  <dt>Land fit</dt>
                  <dd>{metricLabel(scenario.landFit)}</dd>
                </div>
                <div>
                  <dt>Zoning path</dt>
                  <dd>{metricLabel(scenario.zoningEase)}</dd>
                </div>
                <div>
                  <dt>Displacement protection</dt>
                  <dd>{metricLabel(scenario.displacementSafety)}</dd>
                </div>
                <div>
                  <dt>Carbon</dt>
                  <dd>{metricLabel(scenario.carbon)}</dd>
                </div>
                <div>
                  <dt>Climate safety</dt>
                  <dd>{metricLabel(scenario.climate)}</dd>
                </div>
                <div>
                  <dt>Speed</dt>
                  <dd>{metricLabel(scenario.speed)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
