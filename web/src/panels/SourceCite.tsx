import { citeSources, sourceLabel } from '../data/citations'
import type { SourceRecord } from '../data/types'

interface SourceCiteProps {
  sources: readonly SourceRecord[]
  ids: readonly string[]
  /** Provenance chip shown before the links. */
  kind?: 'observed' | 'derived' | 'law'
}

const KIND_LABEL = {
  observed: 'Observed',
  derived: 'Derived',
  law: 'Code',
} as const

/** Links an insight to the snapshot sources that back it. */
export function SourceCite({ sources, ids, kind }: SourceCiteProps) {
  const cited = citeSources(sources, ids)
  if (cited.length === 0) return null

  return (
    <p className="source-cite">
      {kind ? <span className={`provenance ${kind}`}>{KIND_LABEL[kind]}</span> : null}
      {cited.map((source) => (
        <a
          key={source.id}
          className={
            source.available
              ? 'source-cite__link'
              : 'source-cite__link source-cite__link--missing'
          }
          href={source.catalogUrl}
          target="_blank"
          rel="noreferrer"
          title={`${source.publisher}. ${source.vintage}${
            source.available ? '' : '. Not available in this build.'
          }`}
        >
          {sourceLabel(source)}
          {source.available ? '' : ' · missing'}
        </a>
      ))}
    </p>
  )
}
