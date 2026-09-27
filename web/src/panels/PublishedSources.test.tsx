// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DATA_PATHS } from '../data/load'
import { buildManifest } from '../test/builders'
import { PublishedSources } from './PublishedSources'

describe('PublishedSources', () => {
  it('renders catalog links from manifest.json', async () => {
    const manifest = buildManifest()
    const fetchImpl = async (input: string) => {
      if (input !== DATA_PATHS.manifest) {
        return new Response('missing', { status: 404 })
      }
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    render(<PublishedSources heading="Sources in this snapshot" fetchImpl={fetchImpl} />)

    const link = await screen.findByRole('link', { name: manifest.sources[0].title })
    expect(link.getAttribute('href')).toBe(manifest.sources[0].catalogUrl)
    expect(screen.getByText(/not available in this build/)).toBeTruthy()
  })
})
