import { CHECK_SOURCE_IDS } from '../data/citations'
import type { LookupAllowed } from '../data/load'
import type { AreaRecord, MatchStatus, SourceRecord, TypeId } from '../data/types'
import { areaPlace } from '../model/area'
import { pct } from '../shared/format'
import { STATUS_LABELS } from '../shared/labels'
import { DistrictCodeList } from './DistrictCode'
import { SourceCatalog } from './SourceCatalog'
import { SourceCite } from './SourceCite'

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
  area: AreaRecord
  selectedTypeLabel: string
  rows: HousingTypeRow[]
  unknowns: string[]
  sources: readonly SourceRecord[]
  /** Short data-vintage line shown in the heading chip. */
  dataVintage: string
  selectedType?: TypeId
  lookupAllowed?: LookupAllowed
  zoningDraft?: boolean
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

const MEASURE_LABELS: Record<string, string> = {
  total: 'Occupied households',
  hh_1_2: '1–2 person households',
  hh_5_plus: '5+ person households',
  senior_alone: 'Seniors living alone',
  cost_burdened_renters: 'Cost-burdened renters',
  overcrowded: 'Overcrowded households',
  renter_share: 'Renter households',
  total_units: 'Housing units',
  br_0_1: '0–1 bedroom homes',
  br_2: '2 bedroom homes',
  br_3_plus: '3+ bedroom homes',
  units_1_detached: 'Detached single-family',
  units_1_attached: 'Attached single-family',
  units_2_to_4: '2–4 unit buildings',
  units_5_to_19: '5–19 unit buildings',
  units_20_plus: '20+ unit buildings',
  vacant_share: 'Vacant units',
  other_vacant_share: 'Other vacant units',
}

function PercentBar({
  label,
  value,
  tone,
  flagged,
}: {
  label: string
  value: number | null
  tone: 'demand' | 'stock'
  flagged: boolean
}) {
  return (
    <div className="comparison-bar">
      <div className="comparison-label">
        <span>
          {label}
          {flagged ? <em className="moe-flag"> high margin of error</em> : null}
        </span>
        <strong>{pct(value)}</strong>
      </div>
      <div className="bar-track">
        {value == null ? null : (
          <span className={tone} style={{ width: `${Math.max(value * 100, 3)}%` }} />
        )}
      </div>
    </div>
  )
}

export function PlaceReport({
  area,
  selectedTypeLabel,
  rows,
  unknowns,
  sources,
  dataVintage,
  selectedType,
  lookupAllowed,
  zoningDraft = false,
}: PlaceReportProps) {
  const householdSmall = area.households.hh_1_2
  const stockSmall = area.stock.br_0_1
  const gap =
    householdSmall == null || stockSmall == null
      ? null
      : Math.max(0, householdSmall - stockSmall)
  const flagged = new Set(area.moeFlags)

  return (
    <section className="place-report" aria-labelledby="place-heading">
      <div className="report-heading">
        <div>
          <p className="eyebrow">Place report</p>
          <h2 id="place-heading">{area.name}</h2>
          <p className="muted">
            {areaPlace(area)} · GEOID {area.id}
            {area.munis.length > 1 ? ` · also ${area.munis.filter((muni) => muni !== area.muni).join(', ')}` : ''}
          </p>
        </div>
        <div className="report-chips">
          <span className="confidence">
            {Math.round(area.confidence * 100)}% data coverage
          </span>
          <span className="data-vintage-pill">Data: {dataVintage}</span>
        </div>
      </div>

      <div className="insight-card">
        <p className="eyebrow">Who lives here vs. what exists</p>
        <PercentBar
          label="1–2 person households"
          value={householdSmall}
          tone="demand"
          flagged={flagged.has('hh_1_2')}
        />
        <PercentBar
          label="0–1 bedroom homes"
          value={stockSmall}
          tone="stock"
          flagged={flagged.has('br_0_1')}
        />
        <p className="callout">
          {gap == null ? (
            <>
              <strong>Gap not available.</strong> One of the two ACS estimates
              was not published for this tract.
            </>
          ) : (
            <>
              <strong>{Math.round(gap * 100)} point gap.</strong> Smaller homes
              may be under-supplied relative to smaller households.
            </>
          )}
        </p>
        <div className="provenance-row">
          <SourceCite sources={sources} ids={['acs5']} kind="observed" />
          <span className="provenance derived">Derived comparison</span>
        </div>
      </div>

      <div className="insight-card">
        <p className="eyebrow">Household and stock measures</p>
        <dl className="measure-grid">
          {Object.entries(area.households).map(([key, value]) => (
            <div key={`households.${key}`}>
              <dt>{MEASURE_LABELS[key] ?? key}</dt>
              <dd>
                {key === 'total'
                  ? value == null
                    ? 'not available'
                    : value.toLocaleString()
                  : pct(value)}
                {flagged.has(key) ? <em className="moe-flag"> MOE</em> : null}
              </dd>
            </div>
          ))}
          {Object.entries(area.stock).map(([key, value]) => (
            <div key={`stock.${key}`}>
              <dt>{MEASURE_LABELS[key] ?? key}</dt>
              <dd>
                {key === 'total_units'
                  ? value == null
                    ? 'not available'
                    : value.toLocaleString()
                  : pct(value)}
                {flagged.has(key) ? <em className="moe-flag"> MOE</em> : null}
              </dd>
            </div>
          ))}
        </dl>
        {area.moeFlags.length > 0 ? (
          <p className="measure-note">
            Flagged as unreliable (coefficient of variation above threshold or
            fewer than 50 households):{' '}
            {area.moeFlags.map((flag) => MEASURE_LABELS[flag] ?? flag).join(', ')}.
          </p>
        ) : null}
        <SourceCite sources={sources} ids={CHECK_SOURCE_IDS.need} kind="observed" />
      </div>

      <div className="insight-card">
        <p className="eyebrow">Parcels, transit, and hazards</p>
        <dl className="measure-grid">
          <div>
            <dt>Parcels</dt>
            <dd>{area.parcels.total.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Residential parcels</dt>
            <dd>{area.parcels.residential.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Vacant parcels</dt>
            <dd>{area.parcels.vacant.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Rehab candidates</dt>
            <dd>{area.parcels.rehabCandidates.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Weekday transit trips (800 m)</dt>
            <dd>{area.transitTrips800m.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Flood zone share</dt>
            <dd>{pct(area.risk.floodShare)}</dd>
          </div>
          <div>
            <dt>Floodway share</dt>
            <dd>{pct(area.risk.floodwayShare)}</dd>
          </div>
          <div>
            <dt>Steep slope share</dt>
            <dd>{pct(area.risk.slopeShare)}</dd>
          </div>
          <div>
            <dt>Undermined share</dt>
            <dd>{pct(area.risk.undermined)}</dd>
          </div>
          <div>
            <dt>Displacement index</dt>
            <dd>{pct(area.risk.displacement)}</dd>
          </div>
          <div>
            <dt>Vehicle miles per household</dt>
            <dd>
              {area.carbon.vmtPerHh == null
                ? 'not available'
                : area.carbon.vmtPerHh.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Zoning districts</dt>
            <dd>
              <DistrictCodeList
                codes={area.zoningDistricts}
                type={selectedType}
                typeLabel={selectedTypeLabel}
                lookupAllowed={lookupAllowed}
                draft={zoningDraft}
              />
            </dd>
          </div>
        </dl>
        <SourceCite
          sources={sources}
          ids={[...CHECK_SOURCE_IDS.fit, 'flood', 'zoning', 'acs5']}
          kind="observed"
        />
      </div>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Need · Fit · Allowed</p>
          <h3>Housing type match</h3>
        </div>
        <span className="selected-type-chip">{selectedTypeLabel} selected</span>
      </div>
      <div className="type-source-row">
        <SourceCite sources={sources} ids={CHECK_SOURCE_IDS.need} kind="observed" />
        <SourceCite sources={sources} ids={CHECK_SOURCE_IDS.fit} kind="derived" />
        <SourceCite sources={sources} ids={CHECK_SOURCE_IDS.allowed} kind="law" />
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

      <SourceCatalog sources={sources} />
    </section>
  )
}
