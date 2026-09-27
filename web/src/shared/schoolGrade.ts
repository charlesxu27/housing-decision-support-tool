export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F'

/** Average of the published subject shares. One subject is enough. */
export function combinedProficient(
  math: number | null | undefined,
  reading: number | null | undefined,
): number | null {
  const scores = [math, reading].filter((value): value is number => value != null)
  if (scores.length === 0) return null
  return scores.reduce((sum, value) => sum + value, 0) / scores.length
}

/**
 * Letter for a proficient-or-advanced share.
 * A is 80% or higher, B is 60–79%, C is 40–59%, D is 20–39%, F is under 20%.
 */
export function letterGrade(share: number): LetterGrade {
  const percent = Math.round(share * 100)
  if (percent >= 80) return 'A'
  if (percent >= 60) return 'B'
  if (percent >= 40) return 'C'
  if (percent >= 20) return 'D'
  return 'F'
}
