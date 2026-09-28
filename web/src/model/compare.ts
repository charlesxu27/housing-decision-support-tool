import type { LookupAllowed } from '../data/load'
import type {
  AreaRecord,
  Band,
  MatchStatus,
  ParcelTileProperties,
  Provenance,
  TypeId,
  ZoningStatus,
} from '../data/types'
import { STATUS_LABELS } from '../shared/labels'
import { areaLabel, areaStatus, parcelStatus } from './area'
import {
  TRANSIT_SATURATION_TRIPS,
  VALUE_KEYS,
  scoreByWeights,
  type ValueKey,
  type ValueScores,
  type ValueWeights,
} from './scenarios'

export const COMPARE_LIMIT = 3

export type CompareKind = 'tract' | 'parcel'

export interface CompareTractRef {
  kind: 'tract'
  id: string
}

export interface CompareParcelRef {
  kind: 'parcel'
  pin: string
  parcel: ParcelTileProperties
}

export type CompareRef = CompareTractRef | CompareParcelRef

export interface CompareAddResult {
  items: CompareRef[]
  added: boolean
  reason: string | null
}

export interface PlaceMetric {
  id: string
  label: string
  display: string
  /** 0..1 higher-is-better when the row is comparable; null when missing. */
  score: number | null
  provenance: Provenance
  /** Fact rows never change with sliders. Value rows feed the rank. */
  role: 'fact' | 'value'
}

export interface PlaceProfile {
  id: string
  kind: CompareKind
  label: string
  subtitle: string
  status: MatchStatus
  metrics: PlaceMetric[]
  valueScores: ValueScores
  unavailable: string[]
}

export interface PlaceRank {
  id: string
  score: number
  contributions: Record<ValueKey, number>
  excluded: ValueKey[]
}

export const VALUE_LABELS: Record<ValueKey, string> = {
  protectResidents: 'Protect existing residents',
  lowCarbon: 'Low carbon',
  climateSafety: 'Climate safety',
  deepAffordability: 'Deep affordability',
  speedToBuild: 'Speed to build',
}

const BAND_LABELS: Record<Band, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  uncertain: 'Uncertain',
}

const ALLOWED_LABELS: Record<ZoningStatus, string> = {
  by_right: 'By right',
  special_exception: 'Special exception',
  conditional_use: 'Conditional use',
  not_permitted: 'Not permitted',
  unknown: 'Unknown',
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function sameRef(left: CompareRef, right: CompareRef): boolean {
  if (left.kind !== right.kind) return false
  return left.kind === 'tract'
    ? left.id === (right as CompareTractRef).id
    : left.pin === (right as CompareParcelRef).pin
}

export function compareRefId(item: CompareRef): string {
  return item.kind === 'tract' ? item.id : item.pin
}

export function compareKindLabel(kind: CompareKind, count = 0): string {
  if (kind === 'tract') return count === 1 ? 'tract' : 'tracts'
  return count === 1 ? 'parcel' : 'parcels'
}

export function canAddCompare(items: readonly CompareRef[], next: CompareRef): string | null {
  if (items.some((item) => sameRef(item, next))) {
    return 'This place is already in the comparison.'
  }
  if (items.length >= COMPARE_LIMIT) {
    return `Comparison is limited to ${COMPARE_LIMIT} places. Remove one to add another.`
  }
  if (items.length > 0 && items[0].kind !== next.kind) {
    return `Compare ${compareKindLabel(items[0].kind)} to ${compareKindLabel(items[0].kind)}, or clear the list to compare ${compareKindLabel(next.kind)}.`
  }
  return null
}

export function addCompareRef(
  items: readonly CompareRef[],
  next: CompareRef,
): CompareAddResult {
  const reason = canAddCompare(items, next)
  if (reason) return { items: [...items], added: false, reason }
  return { items: [...items, next], added: true, reason: null }
}

export function removeCompareRef(
  items: readonly CompareRef[],
  target: CompareRef,
): CompareRef[] {
  return items.filter((item) => !sameRef(item, target))
}

export function toggleCompareRef(
  items: readonly CompareRef[],
  next: CompareRef,
): CompareAddResult {
  if (items.some((item) => sameRef(item, next))) {
    return {
      items: removeCompareRef(items, next),
      added: false,
      reason: null,
    }
  }
  return addCompareRef(items, next)
}

function zoningSpeed(status: ZoningStatus): number | null {
  switch (status) {
    case 'by_right':
      return 1
    case 'special_exception':
    case 'conditional_use':
      return 0.55
    case 'not_permitted':
      return 0.15
    case 'unknown':
      return null
  }
}

function transitScore(trips: number): number {
  return clampUnit(trips / TRANSIT_SATURATION_TRIPS)
}

function metric(
  id: string,
  label: string,
  display: string,
  score: number | null,
  provenance: Provenance,
  role: PlaceMetric['role'],
): PlaceMetric {
  return { id, label, display, score, provenance, role }
}

function tractValueScores(area: AreaRecord, type: TypeId): {
  valueScores: ValueScores
  unavailable: string[]
} {
  const unavailable: string[] = []
  const displacement = area.risk.displacement
  const needScore = area.needScores[type]
  const costBurden = area.households.cost_burdened_renters
  const allowed = area.allowed[type]
  const speed = zoningSpeed(allowed)
  const climate = area.risk.floodway ? 0 : clampUnit(1 - area.risk.floodShare)
  const transit = transitScore(area.transitTrips800m)

  if (displacement == null) {
    unavailable.push('Displacement index is not available for this tract.')
  }
  if (needScore == null && costBurden == null) {
    unavailable.push('Need score and cost-burdened renter share are not available.')
  }
  if (speed == null) {
    unavailable.push('Zoning path is unknown, so speed to build is not scored.')
  }

  let deepAffordability: number | null = null
  if (needScore != null && costBurden != null) {
    deepAffordability = clampUnit(0.5 * needScore + 0.5 * costBurden)
  } else if (needScore != null) {
    deepAffordability = clampUnit(needScore)
  } else if (costBurden != null) {
    deepAffordability = clampUnit(costBurden)
  }

  return {
    valueScores: {
      protectResidents: displacement == null ? null : clampUnit(1 - displacement),
      lowCarbon: transit,
      climateSafety: climate,
      deepAffordability,
      speedToBuild:
        speed == null ? null : clampUnit(0.75 * speed + 0.25 * transit),
    },
    unavailable,
  }
}

function parcelClimate(parcel: ParcelTileProperties): number {
  if (parcel.floodway === 1) return 0
  let score = parcel.flood === 1 ? 0.35 : 1
  if (parcel.slope === 1) score -= 0.15
  if (parcel.mine === 1) score -= 0.15
  return clampUnit(score)
}

function parcelValueScores(
  parcel: ParcelTileProperties,
  area: AreaRecord | undefined,
  type: TypeId,
  allowed: ZoningStatus,
): { valueScores: ValueScores; unavailable: string[] } {
  const base = area
    ? tractValueScores(area, type)
    : {
        valueScores: {
          protectResidents: null,
          lowCarbon: null,
          climateSafety: null,
          deepAffordability: null,
          speedToBuild: null,
        } satisfies ValueScores,
        unavailable: ['Parent tract is not in the snapshot, so tract metrics are missing.'],
      }

  const speed = zoningSpeed(allowed)
  const fitPass = parcel[`f_${type}`] === 1
  const unavailable = [...base.unavailable]
  if (!area) {
    // already recorded
  }
  if (speed == null) {
    if (!unavailable.some((note) => note.includes('Zoning path'))) {
      unavailable.push('Zoning path is unknown, so speed to build is not scored.')
    }
  }

  return {
    valueScores: {
      protectResidents: base.valueScores.protectResidents,
      lowCarbon: base.valueScores.lowCarbon,
      climateSafety: parcelClimate(parcel),
      deepAffordability: base.valueScores.deepAffordability,
      speedToBuild:
        speed == null
          ? null
          : clampUnit((fitPass ? 1 : 0.25) * (0.75 * speed + 0.25 * (base.valueScores.lowCarbon ?? 0))),
    },
    unavailable,
  }
}

export function buildTractProfile(area: AreaRecord, type: TypeId): PlaceProfile {
  const { valueScores, unavailable } = tractValueScores(area, type)
  const fit = area.fit[type]
  const allowed = area.allowed[type]
  const need = area.need[type]
  const needScore = area.needScores[type]
  const status = areaStatus(area, type)

  const metrics: PlaceMetric[] = [
    metric(
      'need',
      'Need',
      needScore == null
        ? `${BAND_LABELS[need]} need`
        : `${BAND_LABELS[need]} need (${Math.round(needScore * 100)})`,
      needScore,
      'derived',
      'fact',
    ),
    metric(
      'fit',
      'Fit',
      `${BAND_LABELS[fit.band]} · ${fit.parcels.toLocaleString()} suitable parcels · ${fit.homes[0].toLocaleString()}–${fit.homes[1].toLocaleString()} homes`,
      fit.band === 'uncertain' ? null : { high: 1, medium: 0.6, low: 0.2 }[fit.band],
      'derived',
      'fact',
    ),
    metric('allowed', 'Allowed', ALLOWED_LABELS[allowed], zoningSpeed(allowed), 'law', 'fact'),
    metric('status', 'Match status', STATUS_LABELS[status], null, 'derived', 'fact'),
    metric(
      'displacement',
      'Displacement pressure',
      area.risk.displacement == null
        ? 'Not available'
        : `${Math.round(area.risk.displacement * 100)}% index`,
      area.risk.displacement == null ? null : clampUnit(1 - area.risk.displacement),
      'derived',
      'fact',
    ),
    metric(
      'flood',
      'Flood exposure',
      area.risk.floodway
        ? 'Predominantly floodway'
        : `${Math.round(area.risk.floodShare * 100)}% of parcels in a flood zone`,
      area.risk.floodway ? 0 : clampUnit(1 - area.risk.floodShare),
      'observed',
      'fact',
    ),
    metric(
      'transit',
      'Transit access',
      `${area.transitTrips800m.toLocaleString()} weekday trips within 800 m`,
      transitScore(area.transitTrips800m),
      'observed',
      'fact',
    ),
    metric(
      'cost_burden',
      'Cost-burdened renters',
      area.households.cost_burdened_renters == null
        ? 'Not available'
        : `${Math.round(area.households.cost_burdened_renters * 100)}% of renters`,
      area.households.cost_burdened_renters,
      'observed',
      'fact',
    ),
    metric(
      'protectResidents',
      VALUE_LABELS.protectResidents,
      valueScores.protectResidents == null
        ? 'Not scored'
        : `${Math.round(valueScores.protectResidents * 100)}`,
      valueScores.protectResidents,
      'user',
      'value',
    ),
    metric(
      'lowCarbon',
      `${VALUE_LABELS.lowCarbon} (transit proxy)`,
      `${Math.round((valueScores.lowCarbon ?? 0) * 100)}`,
      valueScores.lowCarbon,
      'assumption',
      'value',
    ),
    metric(
      'climateSafety',
      VALUE_LABELS.climateSafety,
      `${Math.round((valueScores.climateSafety ?? 0) * 100)}`,
      valueScores.climateSafety,
      'user',
      'value',
    ),
    metric(
      'deepAffordability',
      VALUE_LABELS.deepAffordability,
      valueScores.deepAffordability == null
        ? 'Not scored'
        : `${Math.round(valueScores.deepAffordability * 100)}`,
      valueScores.deepAffordability,
      'user',
      'value',
    ),
    metric(
      'speedToBuild',
      VALUE_LABELS.speedToBuild,
      valueScores.speedToBuild == null
        ? 'Not scored'
        : `${Math.round(valueScores.speedToBuild * 100)}`,
      valueScores.speedToBuild,
      'user',
      'value',
    ),
  ]

  return {
    id: area.id,
    kind: 'tract',
    label: area.name,
    subtitle: areaLabel(area),
    status,
    metrics,
    valueScores,
    unavailable,
  }
}

function flagLabel(value: -1 | 0 | 1): string {
  if (value === -1) return 'not covered'
  return value === 1 ? 'yes' : 'no'
}

export function buildParcelProfile(
  parcel: ParcelTileProperties,
  area: AreaRecord | undefined,
  type: TypeId,
  lookupAllowed: LookupAllowed,
): PlaceProfile {
  const allowed = lookupAllowed(parcel.zone, type)
  const fitPass = parcel[`f_${type}`] === 1
  const status = parcelStatus(parcel, area, type, lookupAllowed)
  const { valueScores, unavailable } = parcelValueScores(parcel, area, type, allowed)
  const place = [parcel.hood, parcel.muni].filter(Boolean).join(', ')

  const metrics: PlaceMetric[] = [
    metric(
      'need',
      'Need (tract)',
      area == null
        ? 'Tract not in snapshot'
        : needScoreDisplay(area, type),
      area?.needScores[type] ?? null,
      'derived',
      'fact',
    ),
    metric(
      'fit',
      'Fit',
      fitPass ? 'Passes the lot screen' : 'Fails the lot screen',
      fitPass ? 1 : 0,
      'derived',
      'fact',
    ),
    metric('allowed', 'Allowed', ALLOWED_LABELS[allowed], zoningSpeed(allowed), 'law', 'fact'),
    metric('status', 'Match status', STATUS_LABELS[status], null, 'derived', 'fact'),
    metric(
      'lot',
      'Lot size',
      `${Math.round(parcel.lot).toLocaleString()} sq ft · ${parcel.use.replaceAll('_', ' ')}`,
      null,
      'observed',
      'fact',
    ),
    metric(
      'flood',
      'Flood / floodway',
      `Flood zone ${flagLabel(parcel.flood)} · floodway ${flagLabel(parcel.floodway)}`,
      parcelClimate(parcel),
      'observed',
      'fact',
    ),
    metric(
      'hazards',
      'Slope / undermined',
      `Steep slope ${flagLabel(parcel.slope)} · undermined ${flagLabel(parcel.mine)}`,
      null,
      'observed',
      'fact',
    ),
    metric(
      'transit',
      'Transit access (tract)',
      area
        ? `${area.transitTrips800m.toLocaleString()} weekday trips within 800 m`
        : 'Not available',
      area ? transitScore(area.transitTrips800m) : null,
      'observed',
      'fact',
    ),
    metric(
      'displacement',
      'Displacement pressure (tract)',
      area?.risk.displacement == null
        ? 'Not available'
        : `${Math.round(area.risk.displacement * 100)}% index`,
      area?.risk.displacement == null ? null : clampUnit(1 - area.risk.displacement),
      'derived',
      'fact',
    ),
    metric(
      'protectResidents',
      VALUE_LABELS.protectResidents,
      valueScores.protectResidents == null
        ? 'Not scored'
        : `${Math.round(valueScores.protectResidents * 100)}`,
      valueScores.protectResidents,
      'user',
      'value',
    ),
    metric(
      'lowCarbon',
      `${VALUE_LABELS.lowCarbon} (transit proxy)`,
      valueScores.lowCarbon == null
        ? 'Not scored'
        : `${Math.round(valueScores.lowCarbon * 100)}`,
      valueScores.lowCarbon,
      'assumption',
      'value',
    ),
    metric(
      'climateSafety',
      VALUE_LABELS.climateSafety,
      `${Math.round((valueScores.climateSafety ?? 0) * 100)}`,
      valueScores.climateSafety,
      'user',
      'value',
    ),
    metric(
      'deepAffordability',
      VALUE_LABELS.deepAffordability,
      valueScores.deepAffordability == null
        ? 'Not scored'
        : `${Math.round(valueScores.deepAffordability * 100)}`,
      valueScores.deepAffordability,
      'user',
      'value',
    ),
    metric(
      'speedToBuild',
      VALUE_LABELS.speedToBuild,
      valueScores.speedToBuild == null
        ? 'Not scored'
        : `${Math.round(valueScores.speedToBuild * 100)}`,
      valueScores.speedToBuild,
      'user',
      'value',
    ),
  ]

  return {
    id: parcel.pin,
    kind: 'parcel',
    label: `PIN ${parcel.pin}`,
    subtitle: place || `Tract ${parcel.tract}`,
    status,
    metrics,
    valueScores,
    unavailable,
  }
}

function needScoreDisplay(area: AreaRecord, type: TypeId): string {
  const band = area.need[type]
  const score = area.needScores[type]
  return score == null
    ? `${BAND_LABELS[band]} need`
    : `${BAND_LABELS[band]} need (${Math.round(score * 100)})`
}

export function buildProfiles(
  items: readonly CompareRef[],
  areasById: ReadonlyMap<string, AreaRecord>,
  type: TypeId,
  lookupAllowed: LookupAllowed,
): PlaceProfile[] {
  return items.map((item) => {
    if (item.kind === 'tract') {
      const area = areasById.get(item.id)
      if (!area) {
        return {
          id: item.id,
          kind: 'tract',
          label: `Tract ${item.id}`,
          subtitle: 'Not in the loaded snapshot',
          status: 'insufficient_data',
          metrics: [],
          valueScores: {
            protectResidents: null,
            lowCarbon: null,
            climateSafety: null,
            deepAffordability: null,
            speedToBuild: null,
          },
          unavailable: ['This tract is not in the loaded snapshot.'],
        }
      }
      return buildTractProfile(area, type)
    }
    return buildParcelProfile(
      item.parcel,
      areasById.get(item.parcel.tract),
      type,
      lookupAllowed,
    )
  })
}

export function rankPlaces(
  profiles: readonly PlaceProfile[],
  weights: ValueWeights,
): PlaceRank[] {
  return profiles
    .map((profile) => ({
      id: profile.id,
      ...scoreByWeights(profile.valueScores, weights),
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
}

export function rankReason(
  rank: PlaceRank,
  neighbor: PlaceProfile | undefined,
  neighborRank: PlaceRank | undefined,
  ahead: boolean,
): string | null {
  if (!neighbor || !neighborRank) return null
  const gap = Math.round(Math.abs(rank.score - neighborRank.score))
  if (gap === 0) return `Tied with ${neighbor.label} under these priorities.`
  const diffs = VALUE_KEYS.map((key) => ({
    key,
    diff: rank.contributions[key] - neighborRank.contributions[key],
  }))
  const decisive = diffs.reduce((best, item) =>
    (ahead ? item.diff > best.diff : item.diff < best.diff) ? item : best,
  )
  const points = Math.round(Math.abs(decisive.diff))
  const priority = VALUE_LABELS[decisive.key].toLowerCase()
  return ahead
    ? `Leads ${neighbor.label} by ${gap} points, mostly on ${priority} (+${points}).`
    : `Trails ${neighbor.label} by ${gap} points, mostly on ${priority} (−${points}).`
}

/**
 * Names a single weight change that would hand first place to someone else.
 * Returns null when the current leader stays first under those one-at-a-time trials.
 */
export function rankingFlipNote(
  profiles: readonly PlaceProfile[],
  weights: ValueWeights,
): string | null {
  if (profiles.length < 2) return null
  const current = rankPlaces(profiles, weights)
  const winnerId = current[0]?.id
  if (!winnerId) return null
  const winner = profiles.find((profile) => profile.id === winnerId)
  if (!winner) return null

  for (const key of VALUE_KEYS) {
    if (weights[key] <= 0) continue
    const next = { ...weights, [key]: 0 }
    const ranked = rankPlaces(profiles, next)
    if (ranked[0] && ranked[0].id !== winnerId) {
      const challenger = profiles.find((profile) => profile.id === ranked[0].id)
      return `If you stopped weighting ${VALUE_LABELS[key].toLowerCase()}, ${challenger?.label ?? 'another place'} would rank first.`
    }
  }

  for (const key of VALUE_KEYS) {
    if (weights[key] >= 100) continue
    const next = { ...weights, [key]: 100 }
    const ranked = rankPlaces(profiles, next)
    if (ranked[0] && ranked[0].id !== winnerId) {
      const challenger = profiles.find((profile) => profile.id === ranked[0].id)
      return `If you weighted ${VALUE_LABELS[key].toLowerCase()} all the way up, ${challenger?.label ?? 'another place'} would rank first.`
    }
  }

  return null
}
