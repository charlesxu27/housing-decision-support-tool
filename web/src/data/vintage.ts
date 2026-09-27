export function formatBuiltAt(builtAt: string): string {
  const date = new Date(builtAt)
  if (Number.isNaN(date.getTime())) return builtAt
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** "ACS 2020-2024 · built Sep 27, 2026" */
export function dataVintageLabel(manifest: {
  coverage: { acsVintage: string }
  builtAt: string
}): string {
  return `ACS ${manifest.coverage.acsVintage} · built ${formatBuiltAt(manifest.builtAt)}`
}
