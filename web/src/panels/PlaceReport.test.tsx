import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildArea, buildManifest } from '../test/builders'
import { PlaceReport } from './PlaceReport'

describe('PlaceReport source citations', () => {
  it('links household and hazard insights to catalog pages from the snapshot', () => {
    const markup = renderToStaticMarkup(
      <PlaceReport
        area={buildArea()}
        selectedTypeLabel="ADU"
        rows={[]}
        unknowns={['Sewer capacity is unknown.']}
        sources={buildManifest().sources}
        dataVintage="ACS 2020-2024 · built Sep 27, 2026"
      />,
    )

    expect(markup).toContain('href="https://example.org/catalog/acs"')
    expect(markup).toContain('ACS 5-year')
    expect(markup).toContain('HUD CHAS')
    expect(markup).toContain('source-cite__link--missing')
    expect(markup).toContain('not available in this build')
  })
})
