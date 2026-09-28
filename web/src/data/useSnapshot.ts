import { useContext, useEffect } from 'react'
import { SnapshotContext, type SnapshotState } from './snapshotContext'

/**
 * Reads the shared data snapshot. The first consumer triggers the fetch so
 * static pages do not download the metrics file.
 */
export function useSnapshot(): SnapshotState {
  const context = useContext(SnapshotContext)
  if (!context) {
    throw new Error('useSnapshot must be used inside a SnapshotProvider.')
  }
  const { load } = context

  useEffect(() => {
    load()
  }, [load])

  return context
}
