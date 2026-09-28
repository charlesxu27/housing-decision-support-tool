import type { LookupAllowed } from '../data/load'
import {
  TYPE_IDS,
  type AreaRecord,
  type MatchStatus,
  type ParcelTileProperties,
  type TypeId,
  type ZoningStatus,
} from '../data/types'
import { parcelStatus } from './area'
import { STATUS_LABELS, TYPE_LABELS } from '../shared/labels'

export interface LotTypeRow {
  id: TypeId
  label: string
  fit: 'passes' | 'fails'
  allowed: ZoningStatus
  status: MatchStatus
}

export interface LotBriefCard {
  pin: string
  place: string
  selectedType: TypeId
  selectedTypeLabel: string
  selectedStatus: MatchStatus
  lotSqft: number
  use: ParcelTileProperties['use']
  zone: string | null
  building: boolean
  flood: boolean
  floodway: boolean
  slope: 'yes' | 'no' | 'not covered'
  mine: 'yes' | 'no' | 'not covered'
  rehab: boolean
  tract: {
    id: string
    name: string | null
    need: string | null
    costBurdenedRenters: number | null
    renterShare: number | null
    vacantShare: number | null
    hh12: number | null
    smallStock: number | null
    transitTrips800m: number | null
    displacement: number | null
    floodShare: number | null
  }
  types: LotTypeRow[]
}

export interface LotBriefNarrative {
  headline: string
  summary: string
  demand: string
  transit: string
  equity: string
  climate: string
  cost: string
  size: string
  sources_note: string
}

const STATUS_RANK: Record<MatchStatus, number> = {
  ready_match: 0,
  needs_approval: 1,
  blocked_by_zoning: 2,
  zoning_unknown: 3,
  needed_but_hard: 4,
  low_priority: 5,
  not_recommended: 6,
  insufficient_data: 7,
}

const USE_LABELS: Record<ParcelTileProperties['use'], string> = {
  vacant: 'vacant land',
  sf_detached: 'detached single-family',
  sf_attached: 'attached single-family',
  two_family: 'two-family',
  three_family: 'three-family',
  multi_unit: 'multi-unit',
  other: 'other / commercial',
}

function flag(value: -1 | 0 | 1): 'yes' | 'no' | 'not covered' {
  if (value === -1) return 'not covered'
  return value === 1 ? 'yes' : 'no'
}

function pct(value: number | null): string {
  return value == null ? 'not published' : `${Math.round(value * 100)}%`
}

export function buildLotBriefCard(input: {
  parcel: ParcelTileProperties
  area: AreaRecord | undefined
  type: TypeId
  lookupAllowed: LookupAllowed
}): LotBriefCard {
  const { parcel, area, type, lookupAllowed } = input
  const types: LotTypeRow[] = TYPE_IDS
    .map((id) => {
      const fit: LotTypeRow['fit'] = parcel[`f_${id}`] === 1 ? 'passes' : 'fails'
      return {
        id,
        label: TYPE_LABELS[id],
        fit,
        allowed: lookupAllowed(parcel.zone, id),
        status: parcelStatus(parcel, area, id, lookupAllowed),
      }
    })
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.label.localeCompare(b.label),
    )

  return {
    pin: parcel.pin,
    place: [parcel.hood, parcel.muni].filter(Boolean).join(', '),
    selectedType: type,
    selectedTypeLabel: TYPE_LABELS[type],
    selectedStatus: parcelStatus(parcel, area, type, lookupAllowed),
    lotSqft: parcel.lot,
    use: parcel.use,
    zone: parcel.zone,
    building: parcel.bldg === 1,
    flood: parcel.flood === 1,
    floodway: parcel.floodway === 1,
    slope: flag(parcel.slope),
    mine: flag(parcel.mine),
    rehab: parcel.rehab === 1,
    tract: {
      id: parcel.tract,
      name: area?.name ?? null,
      need: area ? area.need[type] : null,
      costBurdenedRenters: area?.households.cost_burdened_renters ?? null,
      renterShare: area?.households.renter_share ?? null,
      vacantShare: area?.stock.vacant_share ?? null,
      hh12: area?.households.hh_1_2 ?? null,
      smallStock: area?.stock.br_0_1 ?? null,
      transitTrips800m: area?.transitTrips800m ?? null,
      displacement: area?.risk.displacement ?? null,
      floodShare: area?.risk.floodShare ?? null,
    },
    types,
  }
}

export function templateLotBrief(card: LotBriefCard): LotBriefNarrative {
  const top = card.types[0]
  const selected = STATUS_LABELS[card.selectedStatus]
  const district = card.zone ?? 'outside the City zoning snapshot'
  const use = USE_LABELS[card.use]

  return {
    headline: `City screen: ${card.selectedTypeLabel} is “${selected}” on this lot`,
    summary: `For city housing staff, PIN ${card.pin} (${card.place || 'Allegheny County'}) is ${use} in ${district}. The selected type, ${card.selectedTypeLabel}, screens as ${selected.toLowerCase()}. Snapshot fit/allowed flags—not a new model—also list ${top.label} as ${STATUS_LABELS[top.status].toLowerCase()}. This is screening language, not a permit.`,
    demand: `Tract ${card.tract.name ?? card.tract.id} need for ${card.selectedTypeLabel} is ${card.tract.need ?? 'unknown'}. About ${pct(card.tract.hh12)} of occupied households have 1–2 people, versus ${pct(card.tract.smallStock)} of units with 0–1 bedrooms. Cost-burdened renters are ${pct(card.tract.costBurdenedRenters)}; vacancy is ${pct(card.tract.vacantShare)}. Those are ACS tract measures, not this building’s asking price.`,
    transit: card.tract.transitTrips800m == null
      ? 'Weekday transit trip counts were not in the snapshot for this tract.'
      : `The snapshot counts ${card.tract.transitTrips800m.toLocaleString()} weekday scheduled transit trips at stops within 800 m of the tract centroid. That is a tract access measure, not a named nearest stop on this PIN.`,
    equity: `Renter share in the tract is ${pct(card.tract.renterShare)}. Displacement-pressure index is ${card.tract.displacement == null ? 'not published' : card.tract.displacement.toFixed(2)}. Use these as screening for who current stock fails—not as a ranking of people.`,
    climate: `This lot flood overlay: ${card.flood ? 'yes' : 'no'}; floodway: ${card.floodway ? 'yes' : 'no'}; steep slope: ${card.slope}; undermined: ${card.mine}. Tract flood-share is ${pct(card.tract.floodShare)}. Floodway lots are gated before other match colors.`,
    cost: `The snapshot does not carry a bid or market value. Site flags that usually raise cost: flood ${card.flood ? 'yes' : 'no'}, slope ${card.slope}, undermining ${card.mine}, renovate candidate ${card.rehab ? 'yes' : 'no'}.`,
    size: `Lot area is ${Math.round(card.lotSqft).toLocaleString()} sq ft. Current use is ${use}${card.building ? ' with a building' : ' with no building on the assessment'}. Fit flags already apply the type-specific lot rules.`,
    sources_note:
      'All figures are from the published map snapshot (Need / Fit / Allowed). The writeup must not invent zoning sections, unit counts, or dollar amounts.',
  }
}
