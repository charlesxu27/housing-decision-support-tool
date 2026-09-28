import { CHECK_SOURCE_IDS } from '../data/citations'
import type { LookupAllowed } from '../data/load'
import {
  TYPE_IDS,
  type AreaRecord,
  type ParcelTileProperties,
  type SourceRecord,
  type TypeId,
  type ZoningMatrix,
} from '../data/types'
import { NEED_COLORS, STATUS_COLORS, markInk, rgbCss } from '../map/colors'
import { parcelStatus } from '../model/area'
import { explainParcel } from '../model/parcelInsight'
import { STATUS_LABELS, TYPE_LABELS } from '../shared/labels'
import type { MapMode } from '../shared/mapState'
import { DistrictCode } from './DistrictCode'
import { LotBrief } from './LotBrief'
import { OpportunityFacts } from './OpportunityFacts'
import { SourceCite } from './SourceCite'

interface ParcelCardProps {
  parcel: ParcelTileProperties
  area: AreaRecord | undefined
  type: TypeId
  typeLabel: string
  mode: MapMode
  lookupAllowed: LookupAllowed
  zoningMatrix: ZoningMatrix | null
  zoningDraft: boolean
  sources: readonly SourceRecord[]
  onClose: () => void
  compareAdded?: boolean
  compareDisabledReason?: string | null
  onAddToCompare?: () => void
}

const USE_LABELS: Record<ParcelTileProperties['use'], string> = {
  vacant: 'Vacant land',
  sf_detached: 'Single-family detached',
  sf_attached: 'Single-family attached',
  two_family: 'Two-family',
  three_family: 'Three-family',
  multi_unit: 'Multi-unit',
  other: 'Other / commercial',
}

const ALLOWED_LABELS: Record<string, string> = {
  by_right: 'By right',
  special_exception: 'Special exception',
  conditional_use: 'Conditional use',
  not_permitted: 'Not permitted',
  unknown: 'Unknown',
}

const OUTCOME_MARKS = {
  pass: '✓',
  caution: '△',
  fail: '×',
  unknown: '?',
} as const

function flag(value: -1 | 0 | 1): string {
  if (value === -1) return 'not covered'
  return value === 1 ? 'yes' : 'no'
}

export function ParcelCard({
  parcel,
  area,
  type,
  typeLabel,
  mode,
  lookupAllowed,
  zoningMatrix,
  zoningDraft,
  sources,
  onClose,
  compareAdded = false,
  compareDisabledReason = null,
  onAddToCompare,
}: ParcelCardProps) {
  const insight = explainParcel({
    parcel,
    area,
    type,
    matrix: zoningMatrix,
    zoningDraft,
  })
  const needBand = area?.need[type]
  const resultLabel =
    mode === 'match' || !needBand
      ? STATUS_LABELS[insight.status]
      : `${needBand[0]!.toUpperCase()}${needBand.slice(1)} need`
  const swatch =
    mode === 'need' && needBand
      ? (NEED_COLORS[needBand] ?? NEED_COLORS.uncertain)
      : (STATUS_COLORS[insight.status] ?? STATUS_COLORS.insufficient_data)
  const place = [parcel.hood, parcel.muni].filter(Boolean).join(', ')

  return (
    <aside className="parcel-card" aria-labelledby="parcel-card-heading">
      <header className="why-color__header">
        <span
          className="why-color__swatch"
          style={{ background: rgbCss(swatch) }}
          aria-hidden="true"
        />
        <div>
          <p className="eyebrow">Why this color</p>
          <h3 id="parcel-card-heading">
            PIN {parcel.pin}: {resultLabel}
          </h3>
          <p className="why-color__type">
            {typeLabel}
            {place ? ` · ${place}` : ''}
          </p>
        </div>
        <button
          className="why-color__close"
          type="button"
          aria-label="Close parcel details"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <p className="why-color__verdict">
        {mode === 'need' ? insight.needVerdict : insight.verdict}
      </p>

      <OpportunityFacts area={area} sources={sources} />

      <LotBrief
        parcel={parcel}
        area={area}
        type={type}
        lookupAllowed={lookupAllowed}
      />

      <ol className="why-color__checks">
        {insight.checks.map((check) => {
          const highlighted = mode === 'need' ? check.id === 'need' : check.decisive
          const paintsColor = highlighted && check.considered
          return (
            <li
              key={check.id}
              className={[
                'why-color__check',
                `why-color__check--${check.outcome}`,
                highlighted ? 'why-color__check--decisive' : '',
                check.considered ? '' : 'why-color__check--skipped',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                paintsColor
                  ? { boxShadow: `inset 3px 0 0 ${rgbCss(swatch)}`, borderColor: rgbCss(swatch) }
                  : undefined
              }
            >
              <span
                className="why-color__mark"
                style={
                  paintsColor
                    ? { background: rgbCss(swatch), color: markInk(swatch) }
                    : undefined
                }
                aria-hidden="true"
              >
                {check.considered ? OUTCOME_MARKS[check.outcome] : '–'}
              </span>
              <div>
                <p className="why-color__check-title">
                  {check.title}
                  <strong>{check.result}</strong>
                </p>
                <ul>
                  {check.id === 'allowed' && parcel.zone ? (
                    <li>
                      This lot:{' '}
                      <DistrictCode
                        code={parcel.zone}
                        typeLabel={typeLabel}
                        status={lookupAllowed(parcel.zone, type)}
                        draft={zoningDraft}
                      />
                    </li>
                  ) : null}
                  {check.metrics.map((metric) => (
                    <li key={metric}>{metric}</li>
                  ))}
                </ul>
                <SourceCite
                  sources={sources}
                  ids={CHECK_SOURCE_IDS[check.id]}
                  kind={
                    check.id === 'allowed' ? 'law' : check.id === 'fit' ? 'derived' : 'observed'
                  }
                />
                {!check.considered ? (
                  <p className="why-color__skipped-note">
                    Not used for this color. An earlier check settled it.
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <details className="parcel-card__more">
        <summary>Lot facts</summary>
        <dl className="parcel-card__facts">
          <div>
            <dt>Lot</dt>
            <dd>{Math.round(parcel.lot).toLocaleString()} sq ft</dd>
          </div>
          <div>
            <dt>Use</dt>
            <dd>{USE_LABELS[parcel.use] ?? parcel.use}</dd>
          </div>
          <div>
            <dt>Building</dt>
            <dd>{parcel.bldg === 1 ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt>Zoning</dt>
            <dd>
              {parcel.zone == null ? (
                'Outside the City'
              ) : (
                <DistrictCode
                  code={parcel.zone}
                  typeLabel={typeLabel}
                  status={lookupAllowed(parcel.zone, type)}
                  draft={zoningDraft}
                />
              )}
            </dd>
          </div>
          <div>
            <dt>Flood zone</dt>
            <dd>{flag(parcel.flood)}</dd>
          </div>
          <div>
            <dt>Floodway</dt>
            <dd>{flag(parcel.floodway)}</dd>
          </div>
          <div>
            <dt>Steep slope</dt>
            <dd>{flag(parcel.slope)}</dd>
          </div>
          <div>
            <dt>Undermined</dt>
            <dd>{flag(parcel.mine)}</dd>
          </div>
          <div>
            <dt>Renovate candidate</dt>
            <dd>{flag(parcel.rehab)}</dd>
          </div>
        </dl>
      </details>

      <details className="parcel-card__more">
        <summary>All housing types on this lot</summary>
        <table className="parcel-card__table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Fit</th>
              <th>Allowed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {TYPE_IDS.map((candidate) => {
              const allowed = lookupAllowed(parcel.zone, candidate)
              const status = parcelStatus(parcel, area, candidate, lookupAllowed)
              return (
                <tr key={candidate}>
                  <th scope="row">{TYPE_LABELS[candidate]}</th>
                  <td>{parcel[`f_${candidate}`] === 1 ? 'passes' : 'fails'}</td>
                  <td>
                    {ALLOWED_LABELS[allowed]}
                    {zoningDraft && parcel.zone != null && allowed !== 'unknown'
                      ? ' (draft)'
                      : ''}
                  </td>
                  <td>
                    <span className={`status-dot status-${status}`} />
                    {STATUS_LABELS[status]}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </details>

      {onAddToCompare ? (
        <button
          className="button button-secondary button-small why-color__compare"
          type="button"
          disabled={compareAdded || Boolean(compareDisabledReason)}
          title={compareDisabledReason ?? undefined}
          onClick={onAddToCompare}
        >
          {compareAdded ? 'Added to compare' : 'Add to compare'}
        </button>
      ) : null}

      <p className="why-color__footnote">
        {area ? `${area.name} · GEOID ${area.id}` : `Tract ${parcel.tract}`} · screening
        only. Verify the lot before acting.
      </p>
    </aside>
  )
}
