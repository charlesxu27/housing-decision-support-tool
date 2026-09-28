/** Formats a 0..1 share; null means the source did not publish a value. */
export function pct(value: number | null | undefined): string {
  return value == null ? 'not available' : `${Math.round(value * 100)}%`
}

/** Formats a dollar amount; null means the source did not publish a value. */
export function dollars(value: number | null | undefined): string {
  return value == null ? 'not available' : `$${Math.round(value).toLocaleString('en-US')}`
}
