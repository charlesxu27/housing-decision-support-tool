import type { Band, HexRecord, MatchStatus, TypeId } from '../data/types'
import { NEED_COLORS, STATUS_COLORS } from '../map/colors'
import type { MapMode } from '../map/MapView'
import {
  explainMatch,
  type MatchCheck,
  type MatchCheckId,
  type MatchCheckOutcome,
} from '../model/match'
import { STATUS_LABELS } from '../shared/labels'

interface WhyThisColorProps {
  cell: HexRecord
  placeName: string
  type: TypeId
  typeLabel: string
  mode: MapMode
  onClose: () => void
}

const STATUS_VERDICTS: Record<MatchStatus, string> = {
  ready_match:
    'Passed all four checks: no floodway, real local need, workable sites, and allowed by right.',
  needs_approval:
    'Passed the hazard, need, and site checks, but zoning requires an approval step.',
  blocked_by_zoning:
    'Need and site fit line up, but current zoning does not permit this type.',
  needed_but_hard:
    'Local need is there, but few sites fit, so zoning was not evaluated.',
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

function pct(value: number | null | undefined): string {
  return value == null ? 'not available' : `${Math.round(value * 100)}%`
}

function rgb([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`
}

function checkResult(
  check: MatchCheck,
  cell: HexRecord,
  type: TypeId,
): string {
  switch (check.id) {
    case 'floodway':
      if (check.outcome === 'unknown') return 'Floodway data missing'
      return check.outcome === 'fail'
        ? 'Floodway present'
        : 'No floodway mapped'
    case 'need':
      if (check.outcome === 'unknown') return 'No need estimate'
      return check.outcome === 'caution'
        ? 'Uncertain need (treated as viable)'
        : `${BAND_LABELS[cell.need[type]]} need`
    case 'fit':
      if (check.outcome === 'unknown') return 'No site-fit estimate'
      return check.outcome === 'caution'
        ? 'Uncertain fit (treated as viable)'
        : `${BAND_LABELS[cell.fit[type].band]} fit`
    case 'allowed':
      switch (cell.allowed[type]) {
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

function checkMetrics(
  id: MatchCheckId,
  cell: HexRecord,
  type: TypeId,
): string[] {
  switch (id) {
    case 'floodway':
      return [`Share of area in a flood zone: ${pct(cell.risk.floodShare)}`]
    case 'need': {
      const metrics = [
        `1–2 person households ${pct(cell.households.hh_1_2)} vs. 0–1 bedroom homes ${pct(cell.stock.br_0_1)}`,
        `Cost-burdened renters: ${pct(cell.households.cost_burdened_renters)}`,
      ]
      if (type === 'senior_accessible') {
        metrics.push(`Seniors living alone: ${pct(cell.households.senior_alone)}`)
      }
      if (type === 'detached_sf' || type === 'large_apartment') {
        metrics.push(
          `5+ person households ${pct(cell.households.hh_5_plus)} vs. 3+ bedroom homes ${pct(cell.stock.br_3_plus)}`,
        )
      }
      if (cell.moeFlags.length > 0) {
        metrics.push(
          `${cell.moeFlags.length} household estimate${cell.moeFlags.length === 1 ? ' has' : 's have'} a high margin of error`,
        )
      }
      return metrics
    }
    case 'fit': {
      const fit = cell.fit[type]
      return [
        `${fit.parcels} suitable parcels · ${fit.homes[0]}–${fit.homes[1]} homes possible`,
        `Steep slopes: ${pct(cell.risk.slopeShare)} · Undermined land: ${pct(cell.risk.undermined)}`,
      ]
    }
    case 'allowed':
      return [
        cell.inCity
          ? 'Illustrative Pittsburgh allowance; code section not yet verified.'
          : `Zoning for ${cell.muni} has not been loaded or verified.`,
      ]
  }
}

export function WhyThisColor({
  cell,
  placeName,
  type,
  typeLabel,
  mode,
  onClose,
}: WhyThisColorProps) {
  const explanation = explainMatch({
    need: cell.need[type],
    fit: cell.fit[type].band,
    allowed: cell.allowed[type],
    floodway: cell.risk.floodway,
  })
  const needBand = cell.need[type]
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
          style={{ background: rgb(swatch) }}
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

      <ol className="why-color__checks">
        {explanation.checks.map((check) => {
          const highlighted =
            mode === 'need' ? check.id === 'need' : check.decisive
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
            >
              <span className="why-color__mark" aria-hidden="true">
                {OUTCOME_MARKS[check.outcome]}
              </span>
              <div>
                <p className="why-color__check-title">
                  {CHECK_TITLES[check.id]}
                  <strong>{checkResult(check, cell, type)}</strong>
                </p>
                <ul>
                  {checkMetrics(check.id, cell, type).map((metric) => (
                    <li key={metric}>{metric}</li>
                  ))}
                </ul>
                {!check.considered ? (
                  <p className="why-color__skipped-note">
                    Not used: an earlier check settled the result.
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <p className="why-color__footnote">
        {Math.round(cell.confidence * 100)}% data coverage · All values are
        illustrative fixtures.
      </p>
    </aside>
  )
}
