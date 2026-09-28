import type { MatchStatus } from '../data/types'

/**
 * One color per match status. The map, legend, status dots, and the check
 * that settles the color all use these values.
 */
export const STATUS_COLORS: Record<MatchStatus, [number, number, number]> = {
  ready_match: [13, 148, 136],
  needs_approval: [240, 168, 35],
  blocked_by_zoning: [126, 87, 194],
  needed_but_hard: [52, 125, 188],
  low_priority: [173, 181, 189],
  zoning_unknown: [92, 101, 110],
  not_recommended: [194, 63, 63],
  /** Same gray as zoning unknown: missing facts share that map category. */
  insufficient_data: [92, 101, 110],
}

export const NEED_COLORS: Record<string, [number, number, number]> = {
  high: [199, 62, 58],
  medium: [237, 159, 48],
  low: [62, 150, 124],
  uncertain: [124, 125, 130],
}

/** Tracts with no loaded snapshot. Lighter than every status gray. */
export const EMPTY_TRACT_RGB: [number, number, number] = [217, 221, 217]

export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`
}

/** Ink for a mark drawn on top of a status color. */
export function markInk([r, g, b]: [number, number, number]): string {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#243028' : '#ffffff'
}
