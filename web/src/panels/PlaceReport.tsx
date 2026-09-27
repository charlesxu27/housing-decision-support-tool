import type { MatchStatus } from '../data/types'
import { STATUS_LABELS } from '../shared/labels'

export interface HousingTypeRow {
  id: string
  label: string
  need: string
  fit: string
  allowed: string
  status: MatchStatus
  parcels: number
  homes: [number, number]
  zoningNote: string
}

interface PlaceReportProps {
  name: string
  municipality: string
  confidence: number
  householdSmall: number
  stockSmall: number
  selectedTypeLabel: string
  rows: HousingTypeRow[]
  unknowns: string[]
}

const BAND_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  uncertain: 'Uncertain',
}

const ALLOWED_LABELS: Record<string, string> = {
  by_right: '✓ By right',
  special_exception: '△ Special exception',
  conditional_use: '△ Conditional use',
  not_permitted: '× Not permitted',
  unknown: '? Unknown',
}

function PercentBar({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'demand' | 'stock'
}) {
  return (
    <div className="comparison-bar">
      <div className="comparison-label">
        <span>{label}</span>
        <strong>{Math.round(value * 100)}%</strong>
      </div>
      <div className="bar-track">
        <span className={tone} style={{ width: `${Math.max(value * 100, 3)}%` }} />
      </div>
    </div>
  )
}

export function PlaceReport({
  name,
  municipality,
  confidence,
  householdSmall,
  stockSmall,
  selectedTypeLabel,
  rows,
  unknowns,
}: PlaceReportProps) {
  const gap = Math.max(0, householdSmall - stockSmall)

  return (
    <section className="place-report" aria-labelledby="place-heading">
      <div className="report-heading">
        <div>
          <p className="eyebrow">Place report</p>
          <h2 id="place-heading">{name}</h2>
          <p className="muted">{municipality}</p>
        </div>
        <span className="confidence">
          {Math.round(confidence * 100)}% data coverage
        </span>
      </div>

      <div className="insight-card">
        <p className="eyebrow">Who lives here vs. what exists</p>
        <PercentBar
          label="1–2 person households"
          value={householdSmall}
          tone="demand"
        />
        <PercentBar
          label="0–1 bedroom homes"
          value={stockSmall}
          tone="stock"
        />
        <p className="callout">
          <strong>{Math.round(gap * 100)} point gap.</strong> Smaller homes may
          be under-supplied relative to smaller households.
        </p>
        <div className="provenance-row">
          <span className="provenance observed">Observed</span>
          <span className="provenance derived">Derived comparison</span>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Need · Fit · Allowed</p>
          <h3>Housing type match</h3>
        </div>
        <span className="selected-type-chip">{selectedTypeLabel} selected</span>
      </div>

      <div className="type-table-wrap">
        <table className="type-table">
          <thead>
            <tr>
              <th>Housing type</th>
              <th>Need</th>
              <th>Fit</th>
              <th>Allowed</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  {row.label}
                  <small>
                    {row.parcels} suitable parcels · {row.homes[0]}–
                    {row.homes[1]} homes
                  </small>
                </th>
                <td>
                  <span className={`band band-${row.need}`}>
                    {BAND_LABELS[row.need] ?? row.need}
                  </span>
                </td>
                <td>
                  <span className={`band band-${row.fit}`}>
                    {BAND_LABELS[row.fit] ?? row.fit}
                  </span>
                </td>
                <td title={row.zoningNote}>
                  {ALLOWED_LABELS[row.allowed] ?? row.allowed}
                </td>
                <td>
                  <span className={`status-dot status-${row.status}`} />
                  {STATUS_LABELS[row.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="unknowns-card">
        <p className="eyebrow">What we do not know</p>
        <ul>
          {unknowns.map((unknown) => (
            <li key={unknown}>{unknown}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
