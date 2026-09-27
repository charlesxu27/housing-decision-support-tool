import { useEffect, useState } from 'react'
import type { z } from 'zod'
import { DataLoadError, loadGeoJson } from '../data/load'
import type { GeoJsonFeatureCollection } from '../data/types'

export interface GeoJsonState<P extends Record<string, unknown>> {
  data: GeoJsonFeatureCollection<P> | null
  error: DataLoadError | null
  loading: boolean
}

interface Settled<P extends Record<string, unknown>> {
  path: string
  data: GeoJsonFeatureCollection<P> | null
  error: DataLoadError | null
}

const cache = new Map<string, Promise<GeoJsonFeatureCollection<Record<string, unknown>>>>()

/** Clears the module-level cache; tests only. */
export function resetGeoJsonCache(): void {
  cache.clear()
}

/**
 * Lazily fetches and validates a GeoJSON file from the snapshot. Results are
 * cached per path for the life of the page so toggling overlays is free.
 */
export function useGeoJson<P extends Record<string, unknown>>(
  path: string | null,
  properties: z.ZodType<P>,
  enabled = true,
): GeoJsonState<P> {
  const [settled, setSettled] = useState<Settled<P> | null>(null)

  useEffect(() => {
    if (!path || !enabled) return
    let cancelled = false
    let promise = cache.get(path) as
      | Promise<GeoJsonFeatureCollection<P>>
      | undefined
    if (!promise) {
      promise = loadGeoJson(path, properties)
      cache.set(
        path,
        promise as Promise<GeoJsonFeatureCollection<Record<string, unknown>>>,
      )
      promise.catch(() => cache.delete(path))
    }
    promise.then(
      (data) => {
        if (!cancelled) setSettled({ path, data, error: null })
      },
      (error: unknown) => {
        if (cancelled) return
        setSettled({
          path,
          data: null,
          error:
            error instanceof DataLoadError
              ? error
              : new DataLoadError(
                  path,
                  'network',
                  error instanceof Error ? error.message : 'request failed',
                ),
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [enabled, path, properties])

  const active = Boolean(path && enabled)
  const current = settled && settled.path === path ? settled : null
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: active && current === null,
  }
}
