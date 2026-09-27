import { findZoningRule } from '../data/load'
import { describeDistrict } from '../data/zoningGlossary'
import type {
  AreaRecord,
  Band,
  MatchStatus,
  ParcelTileProperties,
  TypeId,
  ZoningMatrix,
  ZoningStatus,
} from '../data/types'
import {
  explainMatch,
  type MatchCheck,
  type MatchCheckId,
  type MatchCheckOutcome,
} from './match'

/**
 * Lot-size and transit thresholds copied from `pipeline/config/model.yaml`.
 * The fit flag on the tile is authoritative; these numbers only explain it.
 */
const LOT = {
  adu: 5_000,
  duplexVacant: 3_000,
  duplexConversion: 4_000,
  duplexFinished: 2_400,
  townhome: 6_000,
  smallMin: 8_000,
  smallMax: 43_560,
  large: 21_780,
  senior: 8_000,
  detached: 4_000,
} as const

const TRIPS = { small: 60, large: 120, senior: 60 } as const

const USE_LABELS: Record<ParcelTileProperties['use'], string> = {
  vacant: 'Vacant land',
  sf_detached: 'Single-family detached',
  sf_attached: 'Single-family attached',
  two_family: 'Two-family',
  three_family: 'Three-family',
  multi_unit: 'Multi-unit',
  other: 'Other / commercial',
}

const ALLOWED_LABELS: Record<ZoningStatus, string> = {
  by_right: 'Allowed by right',
  special_exception: 'Needs a special exception',
  conditional_use: 'Needs conditional-use approval',
  not_permitted: 'Not permitted',
  unknown: 'Zoning not verified',
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

const VERDICTS: Record<MatchStatus, string> = {
  ready_match:
    'This lot is not in a floodway, the tract shows need, the lot passes the fit rule, and the district allows this type by right.',
  needs_approval:
    'This lot passes the hazard, need, and fit checks. Zoning requires an approval step before this type could be built.',
  blocked_by_zoning:
    'This lot passes the hazard, need, and fit checks, but the current district does not permit this type.',
  needed_but_hard:
    'The tract shows need, but this lot fails the fit rule, so zoning was not used to color it.',
  low_priority:
    'Need in this tract is low, so this lot’s fit and zoning were not used to color it.',
  zoning_unknown:
    'This lot passes the hazard, need, and fit checks. Its zoning district is not in the snapshot.',
  not_recommended:
    'This lot intersects a regulatory floodway, so it is ruled out before the other checks.',
  insufficient_data:
    'A required input is missing for this lot, so no match color can be given yet.',
}

const FIT_RULES: Record<TypeId, string> = {
  adu: `Rule: detached single-family with a building and a lot of at least ${LOT.adu.toLocaleString()} sq ft. Floodway and steep slopes are excluded.`,
  duplex_triplex: `Rule: vacant lot of at least ${LOT.duplexVacant.toLocaleString()} sq ft, or a detached house with at least ${LOT.duplexFinished.toLocaleString()} sq ft finished and a lot of at least ${LOT.duplexConversion.toLocaleString()} sq ft. Floodway and steep slopes are excluded.`,
  townhome: `Rule: vacant lot of at least ${LOT.townhome.toLocaleString()} sq ft. Floodway and steep slopes are excluded.`,
  small_apartment: `Rule: vacant or commercial lot between ${LOT.smallMin.toLocaleString()} and ${LOT.smallMax.toLocaleString()} sq ft, with at least ${TRIPS.small} weekday transit trips within 800 m. Floodway and steep slopes are excluded.`,
  large_apartment: `Rule: vacant or commercial lot of at least ${LOT.large.toLocaleString()} sq ft, with at least ${TRIPS.large} weekday transit trips within 800 m. Floodway and steep slopes are excluded.`,
  senior_accessible: `Rule: lot of at least ${LOT.senior.toLocaleString()} sq ft, not steep, with at least ${TRIPS.senior} weekday transit trips within 800 m. Floodway lots are excluded.`,
  rehab_reuse:
    'Rule: a building that is condemned, city-owned, or county tax-delinquent. Floodway lots are excluded.',
  detached_sf: `Rule: vacant lot of at least ${LOT.detached.toLocaleString()} sq ft. Floodway and steep slopes are excluded.`,
}

export interface ParcelCheckInsight {
  id: MatchCheckId
  title: string
  result: string
  metrics: string[]
  outcome: MatchCheckOutcome
  considered: boolean
  decisive: boolean
}

export interface ParcelInsight {
  status: MatchStatus
  verdict: string
  needVerdict: string
  checks: ParcelCheckInsight[]
}

function sqft(value: number): string {
  return `${Math.round(value).toLocaleString()} sq ft`
}

function covered(value: -1 | 0 | 1): string {
  if (value === -1) return 'not covered'
  return value === 1 ? 'yes' : 'no'
}

function useLabel(parcel: ParcelTileProperties): string {
  return USE_LABELS[parcel.use] ?? parcel.use
}

function fitBlocker(parcel: ParcelTileProperties, type: TypeId): string {
  if (type !== 'rehab_reuse' && parcel.slope === 1) {
    return 'A mapped slope of 25% or steeper excludes this housing type.'
  }

  switch (type) {
    case 'adu':
      if (parcel.use !== 'sf_detached') {
        return `ADUs are screened on detached single-family lots. This lot is ${useLabel(parcel).toLowerCase()}.`
      }
      if (parcel.bldg !== 1) {
        return 'The assessment shows no building. An ADU screen requires an existing detached house.'
      }
      if (parcel.lot < LOT.adu) {
        return `The lot is ${sqft(parcel.lot)}, under the ${LOT.adu.toLocaleString()} sq ft minimum for an ADU.`
      }
      return 'The recorded fit flag fails even though lot size, use, and building look eligible.'
    case 'duplex_triplex':
      if (parcel.use === 'vacant') {
        return parcel.lot < LOT.duplexVacant
          ? `Vacant lot is ${sqft(parcel.lot)}, under the ${LOT.duplexVacant.toLocaleString()} sq ft minimum for a duplex or triplex.`
          : 'Vacant lot meets the size minimum, but the recorded fit flag fails.'
      }
      if (parcel.use !== 'sf_detached') {
        return `A duplex is screened on a vacant lot or a detached house. This lot is ${useLabel(parcel).toLowerCase()}.`
      }
      if (parcel.bldg !== 1) {
        return 'No building is recorded, so this cannot be a house conversion, and the lot is not vacant.'
      }
      if (parcel.lot < LOT.duplexConversion) {
        return `The lot is ${sqft(parcel.lot)}, under the ${LOT.duplexConversion.toLocaleString()} sq ft minimum for converting a detached house.`
      }
      return `Lot size and use would allow a conversion, but finished living area is under ${LOT.duplexFinished.toLocaleString()} sq ft. That area was applied at build time and is not stored on the lot.`
    case 'townhome':
      if (parcel.use !== 'vacant') {
        return `Townhomes are screened on vacant lots. This lot is ${useLabel(parcel).toLowerCase()}.`
      }
      if (parcel.lot < LOT.townhome) {
        return `Vacant lot is ${sqft(parcel.lot)}, under the ${LOT.townhome.toLocaleString()} sq ft minimum for townhomes.`
      }
      return 'Vacant lot meets the size minimum, but the recorded fit flag fails.'
    case 'detached_sf':
      if (parcel.use !== 'vacant') {
        return `Detached single-family is screened on vacant lots. This lot is ${useLabel(parcel).toLowerCase()}.`
      }
      if (parcel.lot < LOT.detached) {
        return `Vacant lot is ${sqft(parcel.lot)}, under the ${LOT.detached.toLocaleString()} sq ft minimum.`
      }
      return 'Vacant lot meets the size minimum, but the recorded fit flag fails.'
    case 'rehab_reuse':
      if (parcel.bldg !== 1) {
        return 'Rehab is screened on lots with a building. This lot has none.'
      }
      if (parcel.rehab !== 1) {
        return 'The building is not on the condemned, city-owned, or tax-delinquent lists used for rehab.'
      }
      return 'Building and rehab flags look eligible, but the recorded fit flag fails.'
    case 'senior_accessible':
      if (parcel.lot < LOT.senior) {
        return `The lot is ${sqft(parcel.lot)}, under the ${LOT.senior.toLocaleString()} sq ft minimum for senior housing.`
      }
      return `Lot size clears the minimum. Weekday transit trips within 800 m were below ${TRIPS.senior} when the snapshot was built; that count is not stored on the lot.`
    case 'small_apartment':
    case 'large_apartment':
      return apartmentBlocker(parcel, type)
  }
}

function apartmentBlocker(
  parcel: ParcelTileProperties,
  type: 'small_apartment' | 'large_apartment',
): string {
  const min = type === 'small_apartment' ? LOT.smallMin : LOT.large
  const max = type === 'small_apartment' ? LOT.smallMax : null
  const trips = type === 'small_apartment' ? TRIPS.small : TRIPS.large
  if (parcel.use !== 'vacant' && parcel.use !== 'other') {
    return `Apartments are screened on vacant or commercial lots. This lot is ${useLabel(parcel).toLowerCase()}.`
  }
  if (parcel.lot < min) {
    return `The lot is ${sqft(parcel.lot)}, under the ${min.toLocaleString()} sq ft minimum.`
  }
  if (max != null && parcel.lot > max) {
    return `The lot is ${sqft(parcel.lot)}, over the ${max.toLocaleString()} sq ft maximum for a small apartment.`
  }
  return `Lot size is in range. Weekday transit within 800 m was below ${trips} trips when the snapshot was built; that count is not stored on the lot.`
}

function fitMetrics(parcel: ParcelTileProperties, type: TypeId): string[] {
  const passes = parcel[`f_${type}`] === 1
  return [
    passes
      ? 'This lot passed the fit rule when the snapshot was built.'
      : fitBlocker(parcel, type),
    `Use: ${useLabel(parcel)}. Lot: ${sqft(parcel.lot)}. Building: ${parcel.bldg === 1 ? 'yes' : 'no'}.`,
    `Steep slope: ${covered(parcel.slope)}. Undermined: ${covered(parcel.mine)}. Rehab candidate: ${covered(parcel.rehab)}.`,
    FIT_RULES[type],
  ]
}

function needMetrics(area: AreaRecord, type: TypeId): string[] {
  const metrics = [
    'Need is scored for the whole tract. Census does not publish it for one lot.',
    `1–2 person households ${pctShare(area.households.hh_1_2)} vs. 0–1 bedroom homes ${pctShare(area.stock.br_0_1)}.`,
    `Cost-burdened renters: ${pctShare(area.households.cost_burdened_renters)}.`,
    `Need score: ${area.needScores[type] == null ? 'not available' : area.needScores[type]!.toFixed(2)} (county tertiles set the band).`,
  ]
  if (area.moeFlags.length > 0) {
    metrics.push(
      `${area.moeFlags.length} estimate${area.moeFlags.length === 1 ? ' has' : 's have'} a high margin of error: ${area.moeFlags.join(', ')}.`,
    )
  }
  return metrics
}

function pctShare(value: number | null): string {
  return value == null ? 'not available' : `${Math.round(value * 100)}%`
}

function zoningMetrics(
  parcel: ParcelTileProperties,
  type: TypeId,
  matrix: ZoningMatrix | null,
  zoningDraft: boolean,
): string[] {
  if (parcel.zone == null || parcel.zone.trim() === '') {
    return [
      `Zoning for ${parcel.muni} is not in the snapshot. Allowed is computed only inside Pittsburgh.`,
    ]
  }

  const rule = findZoningRule(matrix, parcel.zone, type)
  const described = describeDistrict(parcel.zone)
  const metrics = [
    `This lot only: ${described.name} (${parcel.zone}) in ${parcel.muni}. ${described.about}`,
  ]
  if (!rule) {
    metrics.push('No matrix row covers this district for the selected housing type.')
    return metrics
  }

  const exact =
    rule.district.trim().toUpperCase() === parcel.zone.trim().toUpperCase()
  metrics.push(
    exact
      ? `Matrix row ${rule.district}: ${ALLOWED_LABELS[rule.status].toLowerCase()}.`
      : `No exact row for ${parcel.zone}. Using the ${rule.district} family row: ${ALLOWED_LABELS[rule.status].toLowerCase()}.`,
  )
  if (rule.section || rule.quote) {
    metrics.push(`${rule.section ? `§${rule.section}: ` : ''}${rule.quote}`.trim())
  }
  if (rule.minLotSqft != null) {
    metrics.push(
      `Matrix minimum lot ${rule.minLotSqft.toLocaleString()} sq ft. This lot is ${sqft(parcel.lot)}.`,
    )
  }
  metrics.push(
    zoningDraft
      ? 'Pittsburgh matrix is draft, not human-verified.'
      : rule.verifiedBy
        ? `Reviewed by ${rule.verifiedBy}.`
        : 'Pittsburgh matrix rows are human-verified.',
  )
  return metrics
}

function checkResult(
  check: MatchCheck,
  parcel: ParcelTileProperties,
  area: AreaRecord | undefined,
  type: TypeId,
  matrix: ZoningMatrix | null,
): string {
  switch (check.id) {
    case 'floodway':
      if (check.outcome === 'unknown') return 'Floodway data missing'
      return parcel.floodway === 1
        ? 'This lot is in a regulatory floodway'
        : 'This lot is not in a regulatory floodway'
    case 'need':
      if (check.outcome === 'unknown' || !area) return 'No need estimate'
      return check.outcome === 'caution'
        ? 'Uncertain tract need (treated as viable)'
        : `${BAND_LABELS[area.need[type]]} tract need`
    case 'fit':
      return parcel[`f_${type}`] === 1 ? 'Passes the fit rule' : 'Fails the fit rule'
    case 'allowed':
      return ALLOWED_LABELS[findZoningRule(matrix, parcel.zone, type)?.status ?? 'unknown']
  }
}

function checkMetrics(
  id: MatchCheckId,
  parcel: ParcelTileProperties,
  area: AreaRecord | undefined,
  type: TypeId,
  matrix: ZoningMatrix | null,
  zoningDraft: boolean,
): string[] {
  switch (id) {
    case 'floodway':
      return [
        `Regulatory floodway: ${parcel.floodway === 1 ? 'yes' : 'no'}.`,
        `FEMA flood zone: ${parcel.flood === 1 ? 'yes' : 'no'}.`,
      ]
    case 'need':
      return area
        ? needMetrics(area, type)
        : ['This lot’s tract is not in the loaded snapshot, so need cannot be scored.']
    case 'fit':
      return fitMetrics(parcel, type)
    case 'allowed':
      return zoningMetrics(parcel, type, matrix, zoningDraft)
  }
}

/** Why one parcel received its match color for the selected housing type. */
export function explainParcel(input: {
  parcel: ParcelTileProperties
  area: AreaRecord | undefined
  type: TypeId
  matrix: ZoningMatrix | null
  zoningDraft: boolean
}): ParcelInsight {
  const { parcel, area, type, matrix, zoningDraft } = input
  const allowed = findZoningRule(matrix, parcel.zone, type)?.status ?? 'unknown'
  const explanation = explainMatch({
    need: area?.need[type] ?? null,
    fit: parcel[`f_${type}`] === 1 ? 'high' : 'low',
    allowed,
    floodway: parcel.floodway === 1,
  })
  const needBand = area?.need[type]
  const passes = parcel[`f_${type}`] === 1

  return {
    status: explanation.status,
    verdict: VERDICTS[explanation.status],
    needVerdict: needBand
      ? `The fill in the Need view is this tract’s ${BAND_LABELS[needBand].toLowerCase()} need color. ${
          passes
            ? 'This lot passes the fit rule, so it is drawn solid.'
            : 'This lot fails the fit rule, so it is drawn dimmer.'
        }`
      : 'Need for this tract is not available, so the lot has no need color.',
    checks: explanation.checks.map((check) => ({
      id: check.id,
      title: CHECK_TITLES[check.id],
      result: checkResult(check, parcel, area, type, matrix),
      metrics: checkMetrics(check.id, parcel, area, type, matrix, zoningDraft),
      outcome: check.outcome,
      considered: check.considered,
      decisive: check.decisive,
    })),
  }
}
