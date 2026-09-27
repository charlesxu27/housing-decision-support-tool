import type { FetchLike } from '../data/load'
import { usePublishedManifest } from '../data/usePublishedManifest'
import { SourceCatalog } from './SourceCatalog'

/** Source catalog for pages outside the map, loaded from the published manifest. */
export function PublishedSources({
  heading,
  fetchImpl,
}: {
  heading: string
  fetchImpl?: FetchLike
}) {
  const state = usePublishedManifest(fetchImpl)

  if (state.status === 'loading') {
    return (
      <p className="muted" role="status">
        Loading the source list from the snapshot…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p className="muted" role="alert">
        The source list could not be loaded from {state.error.file}: {state.error.reason}.
      </p>
    )
  }

  return <SourceCatalog sources={state.manifest.sources} heading={heading} />
}
