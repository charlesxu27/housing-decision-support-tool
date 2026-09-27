export const STATUS_COLORS: Record<string, [number, number, number]> = {
  ready_match: [13, 148, 136],
  needs_approval: [240, 168, 35],
  blocked_by_zoning: [126, 87, 194],
  needed_but_hard: [52, 125, 188],
  low_priority: [173, 181, 189],
  zoning_unknown: [92, 101, 110],
  not_recommended: [194, 63, 63],
  insufficient_data: [124, 125, 130],
}

export const NEED_COLORS: Record<string, [number, number, number]> = {
  high: [199, 62, 58],
  medium: [237, 159, 48],
  low: [62, 150, 124],
  uncertain: [124, 125, 130],
}
