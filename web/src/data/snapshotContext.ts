import { createContext } from 'react'
import { matrixLookup, type DataLoadError, type LookupAllowed, type Snapshot } from './load'
import type {
  AreaRecord,
  DataManifest,
  SummaryArea,
  ZoningMatrix,
} from './types'

export type SnapshotStatus = 'loading' | 'error' | 'ready' | 'empty'

export interface SnapshotState {
  status: SnapshotStatus
  error: DataLoadError | null
  manifest: DataManifest | null
  areas: AreaRecord[]
  areasById: Map<string, AreaRecord>
  summaries: SummaryArea[]
  summariesById: Map<string, SummaryArea>
  zoningMatrix: ZoningMatrix | null
  lookupAllowed: LookupAllowed
  /** The fully loaded bundle when `status` is `ready`, otherwise null. */
  snapshot: Snapshot | null
  /**
   * Starts loading if nothing has been requested yet. Pass `true` to force a
   * reload (used by the retry button after an error).
   */
  load: (force?: boolean) => void
}

export const EMPTY_SNAPSHOT_STATE: Omit<SnapshotState, 'load'> = {
  status: 'loading',
  error: null,
  manifest: null,
  areas: [],
  areasById: new Map(),
  summaries: [],
  summariesById: new Map(),
  zoningMatrix: null,
  lookupAllowed: (zone, type) => matrixLookup(null, zone, type),
  snapshot: null,
}

export const SnapshotContext = createContext<SnapshotState | null>(null)
