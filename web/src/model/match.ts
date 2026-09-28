import type {
  Band,
  MatchStatus,
  ZoningStatus,
} from '../data/types'

export interface MatchInputs {
  need?: Band | null
  fit?: Band | null
  allowed?: ZoningStatus | null
  floodway?: boolean | null
}

/**
 * Derives the categorical match result from factual model outputs.
 *
 * Ordering is intentional: floodway is a hard gate, low need takes precedence
 * over fit, and zoning is considered only after both need and fit are viable.
 */
export function deriveMatchStatus({
  need,
  fit,
  allowed,
  floodway,
}: MatchInputs): MatchStatus {
  if (floodway === true) {
    return 'not_recommended'
  }

  if (floodway == null || need == null || fit == null) {
    return 'insufficient_data'
  }

  if (need === 'low') {
    return 'low_priority'
  }

  if (fit === 'low') {
    return 'needed_but_hard'
  }

  if (allowed == null) {
    return 'insufficient_data'
  }

  switch (allowed) {
    case 'by_right':
      return 'ready_match'
    case 'special_exception':
    case 'conditional_use':
      return 'needs_approval'
    case 'not_permitted':
      return 'blocked_by_zoning'
    case 'unknown':
      return 'zoning_unknown'
  }
}

export type MatchCheckId = 'floodway' | 'need' | 'fit' | 'allowed'

export type MatchCheckOutcome = 'pass' | 'caution' | 'fail' | 'unknown'

export interface MatchCheck {
  id: MatchCheckId
  outcome: MatchCheckOutcome
  /** False when an earlier check already settled the result. */
  considered: boolean
  /** True for the check that settled the result. */
  decisive: boolean
}

export interface MatchExplanation {
  status: MatchStatus
  checks: MatchCheck[]
}

const CHECK_ORDER: readonly MatchCheckId[] = ['floodway', 'need', 'fit', 'allowed']

function checkOutcome(id: MatchCheckId, inputs: MatchInputs): MatchCheckOutcome {
  switch (id) {
    case 'floodway':
      if (inputs.floodway == null) return 'unknown'
      return inputs.floodway ? 'fail' : 'pass'
    case 'need':
    case 'fit': {
      const band = inputs[id]
      if (band == null) return 'unknown'
      if (band === 'low') return 'fail'
      return band === 'uncertain' ? 'caution' : 'pass'
    }
    case 'allowed':
      switch (inputs.allowed) {
        case 'by_right':
          return 'pass'
        case 'special_exception':
        case 'conditional_use':
          return 'caution'
        case 'not_permitted':
          return 'fail'
        default:
          return 'unknown'
      }
  }
}

function missingInput(id: MatchCheckId, inputs: MatchInputs): boolean {
  return inputs[id] == null
}

function decisiveCheck(status: MatchStatus, inputs: MatchInputs): MatchCheckId {
  switch (status) {
    case 'not_recommended':
      return 'floodway'
    case 'low_priority':
      return 'need'
    case 'needed_but_hard':
      return 'fit'
    case 'insufficient_data':
      return CHECK_ORDER.find((id) => missingInput(id, inputs)) ?? 'allowed'
    default:
      return 'allowed'
  }
}

/**
 * Explains `deriveMatchStatus` as an ordered checklist so the UI can show
 * which checks passed, which one settled the result, and which were skipped.
 */
export function explainMatch(inputs: MatchInputs): MatchExplanation {
  const status = deriveMatchStatus(inputs)
  const decisive = decisiveCheck(status, inputs)
  const gated =
    status === 'not_recommended' ||
    status === 'low_priority' ||
    status === 'needed_but_hard'
  const decisiveIndex = CHECK_ORDER.indexOf(decisive)

  return {
    status,
    checks: CHECK_ORDER.map((id, index) => ({
      id,
      outcome: checkOutcome(id, inputs),
      considered: !gated || index <= decisiveIndex,
      decisive: id === decisive,
    })),
  }
}
