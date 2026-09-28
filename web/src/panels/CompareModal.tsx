import { useEffect } from 'react'
import { STATUS_LABELS } from '../shared/labels'
import {
  VALUE_LABELS,
  compareKindLabel,
  rankPlaces,
  rankReason,
  type PlaceProfile,
} from '../model/compare'
import { VALUE_KEYS, type ValueKey, type ValueWeights } from '../model/scenarios'

interface CompareModalProps {
  typeLabel: string
  profiles: readonly PlaceProfile[]
  weights: ValueWeights
  onWeightChange: (key: ValueKey, value: number) => void
  onClose: () => void
}

const WEIGHT_META: { key: ValueKey; label: string }[] = VALUE_KEYS.map((key) => ({
  key,
  label: VALUE_LABELS[key],
}))

const LENSES: { label: string; weights: ValueWeights }[] = [
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

const PROVENANCE_LABELS: Record<string, string> = {
  observed: 'Observed',
  derived: 'Derived',
  assumption: 'Assumption',
  law: 'Law',
  user: 'Your values',
}

function provenanceClass(kind: string): string {
  if (kind === 'user') return 'user-value'
  return kind
}

export function CompareModal({
  typeLabel,
  profiles,
  weights,
  onWeightChange,
  onClose,
}: CompareModalProps) {
  const ranked = rankPlaces(profiles, weights)
  const rankedProfiles = ranked
    .map((rank) => profiles.find((profile) => profile.id === rank.id))
    .filter((profile): profile is PlaceProfile => profile != null)
  const factRows = rankedProfiles[0]?.metrics.filter((row) => row.role === 'fact') ?? []
  const kind = profiles[0]?.kind ?? 'tract'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="compare-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        className="compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-heading"
      >
        <header className="compare-modal__header">
          <div>
            <p className="eyebrow">Place comparison</p>
            <h2 id="compare-heading">
              {profiles.length} {compareKindLabel(kind, profiles.length)} · {typeLabel}
            </h2>
            <p className="muted">
              Need, fit, zoning, and hazards are facts. The rank number is a value
              judgment under the sliders on the left.
            </p>
            <span className="provenance user-value">Your values</span>
          </div>
          <button
            className="compare-modal__close"
            type="button"
            aria-label="Close comparison"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="compare-modal__layout">
          <div className="values-panel">
            <p className="eyebrow">What should this decision prioritize?</p>
            <div className="lens-list" aria-label="Priority presets">
              {LENSES.map((lens) => (
                <button
                  key={lens.label}
                  type="button"
                  onClick={() => {
                    for (const [key, value] of Object.entries(lens.weights)) {
                      onWeightChange(key as ValueKey, value)
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
              </label>
            ))}
            <p className="values-note">
              These controls express priorities. They do not alter household,
              parcel, hazard, or zoning facts.
            </p>
          </div>

          <div className="compare-modal__results">
            <div className="compare-rank-cards">
              {rankedProfiles.map((profile, index) => {
                const rank = ranked[index]
                const neighbor = index === 0 ? rankedProfiles[1] : rankedProfiles[index - 1]
                const neighborRank = index === 0 ? ranked[1] : ranked[index - 1]
                return (
                  <article
                    key={profile.id}
                    className={`compare-rank-card ${index === 0 ? 'recommended' : ''}`}
                  >
                    <div className="scenario-card-heading">
                      <div>
                        <span className="scenario-rank">#{index + 1}</span>
                        <h3>{profile.label}</h3>
                      </div>
                      <strong>{Math.round(rank.score)}</strong>
                    </div>
                    <p className="compare-rank-card__sub">{profile.subtitle}</p>
                    <p className="score-reason">
                      {index === 0
                        ? rankReason(rank, neighbor, neighborRank, true)
                        : rankReason(rank, neighbor, neighborRank, false)}
                    </p>
                    <p className="compare-rank-card__status">
                      {STATUS_LABELS[profile.status]}
                    </p>
                    <ul className="compare-contributions">
                      {WEIGHT_META.map((item) => (
                        <li
                          key={item.key}
                          className={
                            rank.excluded.includes(item.key)
                              ? 'score-breakdown__row--excluded'
                              : undefined
                          }
                        >
                          <span>{item.label}</span>
                          <span>
                            {rank.excluded.includes(item.key)
                              ? 'Not scored'
                              : Math.round(rank.contributions[item.key])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>

            <table className="compare-table">
              <caption>Fact rows stay fixed. Value rows change only the rank.</caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {rankedProfiles.map((profile) => (
                    <th key={profile.id} scope="col">
                      {profile.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {factRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <span className="compare-table__metric">
                        <span>{row.label}</span>
                        <span className={`provenance ${provenanceClass(row.provenance)}`}>
                          {PROVENANCE_LABELS[row.provenance] ?? row.provenance}
                        </span>
                      </span>
                    </th>
                    {rankedProfiles.map((profile) => {
                      const cell = profile.metrics.find((item) => item.id === row.id)
                      return <td key={profile.id}>{cell?.display ?? '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {rankedProfiles.some((profile) => profile.unavailable.length > 0) ? (
              <ul className="compare-unavailable">
                {rankedProfiles.flatMap((profile) =>
                  profile.unavailable.map((note) => (
                    <li key={`${profile.id}:${note}`}>
                      {profile.label}: {note}
                    </li>
                  )),
                )}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
