import type { SnapshotState } from './snapshotContext'

interface DataStateProps {
  state: SnapshotState
  /** What the surrounding page is waiting for, e.g. "the map workspace". */
  subject: string
}

/**
 * Loading, error, and empty states for pages that depend on the snapshot.
 * Errors name the failing file and reason; nothing is substituted.
 */
export function DataState({ state, subject }: DataStateProps) {
  if (state.status === 'loading') {
    return (
      <section className="data-state" role="status" aria-live="polite">
        <p className="eyebrow">Loading data</p>
        <h2>Loading {subject}…</h2>
        <p>Fetching the published snapshot from /data.</p>
      </section>
    )
  }

  if (state.status === 'error') {
    const { error } = state
    return (
      <section className="data-state data-state--error" role="alert">
        <p className="eyebrow">Data could not be loaded</p>
        <h2>{subject} is unavailable</h2>
        <dl>
          <div>
            <dt>File</dt>
            <dd>
              <code>{error?.file ?? 'unknown'}</code>
            </dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{error?.reason ?? 'unknown failure'}</dd>
          </div>
          <div>
            <dt>Failure type</dt>
            <dd>{error?.kind ?? 'unknown'}</dd>
          </div>
        </dl>
        <p>
          No substitute values are shown. Rebuild the snapshot with the data
          pipeline or check the deployment, then retry.
        </p>
        <button className="button" type="button" onClick={() => state.load(true)}>
          Retry
        </button>
      </section>
    )
  }

  if (state.status === 'empty') {
    return (
      <section className="data-state" role="status">
        <p className="eyebrow">No analysis areas</p>
        <h2>The snapshot contains no tracts</h2>
        <p>
          The manifest loaded
          {state.manifest ? ` (built ${state.manifest.builtAt})` : ''} but
          area_metrics.json has zero areas. Run the pipeline build and
          validate steps.
        </p>
      </section>
    )
  }

  return null
}
