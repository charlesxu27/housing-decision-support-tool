import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DataLoadError,
  loadSnapshot,
  type FetchLike,
  type Snapshot,
} from './load'
import {
  EMPTY_SNAPSHOT_STATE,
  SnapshotContext,
  type SnapshotState,
} from './snapshotContext'

type LoadResult =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; snapshot: Snapshot }
  | { kind: 'error'; error: DataLoadError }

interface SnapshotProviderProps {
  children: ReactNode
  /** Injectable for tests; defaults to `window.fetch`. */
  fetchImpl?: FetchLike
  /** Start fetching on mount instead of waiting for the first consumer. */
  eager?: boolean
}

export function SnapshotProvider({
  children,
  fetchImpl,
  eager = false,
}: SnapshotProviderProps) {
  const [result, setResult] = useState<LoadResult>({ kind: 'idle' })
  const requestId = useRef(0)
  const kindRef = useRef<LoadResult['kind']>('idle')

  useEffect(() => {
    kindRef.current = result.kind
  }, [result.kind])

  const load = useCallback(
    (force = false) => {
      if (!force && kindRef.current !== 'idle') return
      requestId.current += 1
      const id = requestId.current
      kindRef.current = 'loading'
      setResult({ kind: 'loading' })
      loadSnapshot(fetchImpl).then(
        (snapshot) => {
          if (requestId.current === id) setResult({ kind: 'ready', snapshot })
        },
        (error: unknown) => {
          if (requestId.current !== id) return
          const loadError =
            error instanceof DataLoadError
              ? error
              : new DataLoadError(
                  '/data/*',
                  'network',
                  error instanceof Error ? error.message : 'unknown failure',
                )
          setResult({ kind: 'error', error: loadError })
        },
      )
    },
    [fetchImpl],
  )

  useEffect(() => {
    if (eager) load()
  }, [eager, load])

  const value = useMemo<SnapshotState>(() => {
    if (result.kind === 'ready') {
      const { snapshot } = result
      return {
        ...EMPTY_SNAPSHOT_STATE,
        status: snapshot.areas.length === 0 ? 'empty' : 'ready',
        manifest: snapshot.manifest,
        areas: snapshot.areas,
        areasById: snapshot.areasById,
        summaries: snapshot.summaries,
        summariesById: snapshot.summariesById,
        zoningMatrix: snapshot.zoningMatrix,
        lookupAllowed: snapshot.lookupAllowed,
        snapshot,
        load,
      }
    }
    if (result.kind === 'error') {
      return { ...EMPTY_SNAPSHOT_STATE, status: 'error', error: result.error, load }
    }
    return { ...EMPTY_SNAPSHOT_STATE, status: 'loading', load }
  }, [load, result])

  return (
    <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>
  )
}
