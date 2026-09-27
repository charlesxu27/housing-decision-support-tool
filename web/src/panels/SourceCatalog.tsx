import type { SourceRecord } from '../data/types'

interface SourceCatalogProps {
  sources: readonly SourceRecord[]
  heading?: string
}

/** Full source list from the snapshot, each title linked to its catalog page. */
export function SourceCatalog({ sources, heading = 'Sources' }: SourceCatalogProps) {
  return (
    <div className="unknowns-card sources-card" id="sources">
      <p className="eyebrow">{heading}</p>
      <ul>
        {sources.map((source) => (
          <li key={source.id}>
            <a href={source.catalogUrl} target="_blank" rel="noreferrer">
              <strong>{source.title}</strong>
            </a>
            <span className="source-catalog__meta">
              {source.publisher} · {source.vintage}
              {source.available ? '' : ' · not available in this build'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
