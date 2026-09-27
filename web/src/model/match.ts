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
