import { CHECK_SOURCE_IDS } from '../data/citations'
import type { LookupAllowed } from '../data/load'
import type { AreaRecord, Band, MatchStatus, SourceRecord, TypeId } from '../data/types'
import { DistrictCodeList } from './DistrictCode'
import { OpportunityFacts } from './OpportunityFacts'
import { SourceCite } from './SourceCite'
import { NEED_COLORS, STATUS_COLORS, markInk, rgbCss } from '../map/colors'
import {
  explainMatch,
  type MatchCheck,
  type MatchCheckId,
  type MatchCheckOutcome,
} from '../model/match'
import { describeNeedScore, describeSmallHouseholdGap } from '../model/needBands'
import { pct } from '../shared/format'
import { STATUS_LABELS } from '../shared/labels'
import type { MapMode } from '../shared/mapState'

interface WhyThisColorProps {
  area: AreaRecord
  placeName: string
  type: TypeId
  typeLabel: string
  mode: MapMode
  /** True when the Pittsburgh zoning matrix has not been human-verified. */
  zoningDraft: boolean
  lookupAllowed: LookupAllowed
  sources: readonly SourceRecord[]
  onClose: () => void
  compareAdded?: boolean
  compareDisabledReason?: string | null
  onAddToCompare?: () => void
}

const STATUS_VERDICTS: Record<MatchStatus, string> = {
  ready_match:
    'Passed all four checks: no floodway, real local need, workable sites, and allowed by right.',
  needs_approval:
    'Passed the hazard, need, and site checks, but zoning requires an approval step.',
  blocked_by_zoning:
    'Need and site fit line up, but current zoning does not permit this type.',
  needed_but_hard:
    'Local need is there, but no lots pass the fit rule, so zoning was not evaluated.',
  low_priority:
    'Local need for this type is low, so site fit and zoning were not evaluated.',
  zoning_unknown:
    'Passed the hazard, need, and site checks; zoning still needs verification.',
  not_recommended:
    'A mapped floodway rules this area out before any other check.',
  insufficient_data:
    'A required input is missing, so no match result can be given yet.',
}

const BAND_LABELS: Record<Band, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  uncertain: 'Uncertain',
}

const CHECK_TITLES: Record<MatchCheckId, string> = {
  floodway: 'Hazard gate',
  need: 'Local need',
  fit: 'Site fit',
  allowed: 'Zoning',
}

const OUTCOME_MARKS: Record<MatchCheckOutcome, string> = {
  pass: '✓',
  caution: '△',
  fail: '×',
  unknown: '?',
}

function checkResult(
  check: MatchCheck,
  area: AreaRecord,
  type: TypeId,
): string {
  switch (check.id) {
    case 'floodway':
      if (check.outcome === 'unknown') return 'Floodway data missing'
      return check.outcome === 'fail'
        ? 'Mostly regulatory floodway'
        : 'Not predominantly floodway'
    case 'need':
      if (check.outcome === 'unknown') return 'No need estimate'
      return check.outcome === 'caution'
        ? 'Uncertain need (treated as viable)'
        : `${BAND_LABELS[area.need[type]]} need`
    case 'fit':
      if (check.outcome === 'unknown') return 'No site-fit estimate'
      return check.outcome === 'caution'
        ? 'Uncertain fit (treated as viable)'
        : `${BAND_LABELS[area.fit[type].band]} fit`
    case 'allowed':
      switch (area.allowed[type]) {
        case 'by_right':
          return 'Allowed by right'
        case 'special_exception':
          return 'Needs a special exception'
        case 'conditional_use':
          return 'Needs conditional-use approval'
        case 'not_permitted':
          return 'Not permitted'
        default:
          return 'Zoning not verified'
      }
  }
}

function shareBreakdown(area: AreaRecord, type: TypeId): string | null {
  const entries = Object.entries(area.allowedShares[type] ?? {})
    .filter(([, share]) => share != null && share > 0)
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
  if (entries.length === 0) return null
  return entries
    .map(([status, share]) => `${Math.round((share ?? 0) * 100)}% ${status.replaceAll('_', ' ')}`)
    .join(' · ')
}

function checkMetrics(
  id: MatchCheckId,
  area: AreaRecord,
  type: TypeId,
  zoningDraft: boolean,
): string[] {
  switch (id) {
    case 'floodway':
      return [
        `Parcels in a FEMA flood zone: ${pct(area.risk.floodShare)} · in a regulatory floodway: ${pct(area.risk.floodwayShare)}`,
      ]
    case 'need': {
      const metrics = [
        describeSmallHouseholdGap(area),
        `Cost-burdened renters: ${pct(area.households.cost_burdened_renters)}`,
        describeNeedScore(area.needScores[type]),
      ]
      if (type === 'senior_accessible') {
        metrics.push(`Seniors living alone: ${pct(area.households.senior_alone)}`)
      }
      if (type === 'detached_sf' || type === 'large_apartment') {
        metrics.push(
          `5+ person households ${pct(area.households.hh_5_plus)} vs. 3+ bedroom homes ${pct(area.stock.br_3_plus)}`,
        )
      }
      if (type === 'rehab_reuse') {
        metrics.push(`Other vacant units: ${pct(area.stock.other_vacant_share)}`)
      }
      if (area.moeFlags.length > 0) {
        metrics.push(
          `${area.moeFlags.length} estimate${area.moeFlags.length === 1 ? ' has' : 's have'} a high margin of error: ${area.moeFlags.join(', ')}`,
        )
      }
      return metrics
    }
    case 'fit': {
      const fit = area.fit[type]
      return [
        `${fit.parcels} suitable parcels · ${fit.homes[0]}–${fit.homes[1]} homes possible`,
        `Steep slopes: ${pct(area.risk.slopeShare)} · Undermined land: ${pct(area.risk.undermined)} · Weekday transit trips within 800 m: ${area.transitTrips800m.toLocaleString()}`,
      ]
    }
    case 'allowed': {
      if (!area.inCity) {
        return [
          `Zoning for ${area.muni} is not in the snapshot; Allowed is computed only inside Pittsburgh.`,
        ]
      }
      const metrics: string[] = []
      const breakdown = shareBreakdown(area, type)
      if (breakdown) metrics.push(`Parcel share by status: ${breakdown}`)
      metrics.push(
        zoningDraft
          ? 'Pittsburgh matrix is draft, not human-verified.'
          : 'Pittsburgh matrix rows are human-verified.',
      )
      if (type === 'adu') {
        metrics.push(
          'ADU rows follow pending Council Bill 2025-1545 proposed §912.08, not an adopted ordinance.',
        )
      }
      return metrics
    }
  }
}

export function WhyThisColor({
  area,
  placeName,
  type,
  typeLabel,
  mode,
  zoningDraft,
  lookupAllowed,
  sources,
  onClose,
  compareAdded = false,
  compareDisabledReason = null,
  onAddToCompare,
}: WhyThisColorProps) {
  const explanation = explainMatch({
    need: area.need[type],
    fit: area.fit[type].band,
    allowed: area.allowed[type],
    floodway: area.risk.floodway,
  })
  const needBand = area.need[type]
  const resultLabel =
    mode === 'match'
      ? STATUS_LABELS[explanation.status]
      : `${BAND_LABELS[needBand]} need`
  const swatch =
    mode === 'match'
      ? (STATUS_COLORS[explanation.status] ?? STATUS_COLORS.insufficient_data)
      : (NEED_COLORS[needBand] ?? NEED_COLORS.uncertain)
  const verdict =
    mode === 'match'
      ? STATUS_VERDICTS[explanation.status]
      : `Local need for ${typeLabel.toLowerCase()} is rated ${BAND_LABELS[needBand].toLowerCase()}. The need evidence below drives the color; the other checks show the full match result (${STATUS_LABELS[explanation.status]}).`

  return (
    <aside className="why-color" aria-labelledby="why-color-heading">
      <header className="why-color__header">
        <span
          className="why-color__swatch"
          style={{ background: rgbCss(swatch) }}
          aria-hidden="true"
        />
        <div>
          <p className="eyebrow">Why this color</p>
          <h3 id="why-color-heading">
            {placeName}: {resultLabel}
          </h3>
          <p className="why-color__type">{typeLabel}</p>
        </div>
        <button
          className="why-color__close"
          type="button"
          aria-label="Close explanation"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <p className="why-color__verdict">{verdict}</p>

      <OpportunityFacts area={area} sources={sources} />

      <ol className="why-color__checks">
        {explanation.checks.map((check) => {
          const highlighted =
            mode === 'need' ? check.id === 'need' : check.decisive
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
                  {CHECK_TITLES[check.id]}
                  <strong>{checkResult(check, area, type)}</strong>
                </p>
                <ul>
                  {check.id === 'allowed' && area.inCity ? (
                    <li>
                      Districts present:{' '}
                      <DistrictCodeList
                        codes={area.zoningDistricts}
                        type={type}
                        typeLabel={typeLabel}
                        lookupAllowed={lookupAllowed}
                        draft={zoningDraft}
                      />
                    </li>
                  ) : null}
                  {checkMetrics(check.id, area, type, zoningDraft).map((metric) => (
                    <li key={metric}>{metric}</li>
                  ))}
                </ul>
                <SourceCite
                  sources={sources}
                  ids={CHECK_SOURCE_IDS[check.id]}
                  kind={check.id === 'allowed' ? 'law' : check.id === 'fit' ? 'derived' : 'observed'}
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
        {Math.round(area.confidence * 100)}% data coverage · GEOID {area.id} ·
        values marked not available were not published by the source.
      </p>
    </aside>
  )
}
