import { useEffect, useState } from 'react'
import {
  DATA_PATHS,
  DataLoadError,
  fetchValidated,
  manifestSchema,
  type FetchLike,
} from './load'
import type { DataManifest } from './types'

export type PublishedManifestState =
  | { status: 'loading'; manifest: null; error: null }
  | { status: 'ready'; manifest: DataManifest; error: null }
  | { status: 'error'; manifest: null; error: DataLoadError }

/**
 * Loads only `manifest.json`, which carries the source catalog. Pages that
 * do not need tracts or geometries use this instead of the full snapshot.
 */
export function usePublishedManifest(fetchImpl?: FetchLike): PublishedManifestState {
  const [state, setState] = useState<PublishedManifestState>({
    status: 'loading',
    manifest: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    fetchValidated(DATA_PATHS.manifest, manifestSchema, fetchImpl).then(
      (manifest) => {
        if (!cancelled) setState({ status: 'ready', manifest, error: null })
      },
      (error: unknown) => {
        if (cancelled) return
        const loadError =
          error instanceof DataLoadError
            ? error
            : new DataLoadError(
                DATA_PATHS.manifest,
                'network',
                error instanceof Error ? error.message : 'unknown failure',
              )
        setState({ status: 'error', manifest: null, error: loadError })
      },
    )
    return () => {
      cancelled = true
    }
  }, [fetchImpl])

  return state
}
