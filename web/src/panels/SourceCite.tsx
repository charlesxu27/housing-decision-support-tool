import { useId } from 'react'
import { citeSources, sourceLabel } from '../data/citations'
import type { SourceRecord } from '../data/types'

interface SourceCiteProps {
  sources: readonly SourceRecord[]
  ids: readonly string[]
  /** Provenance chip shown beside the sources control. */
  kind?: 'observed' | 'derived' | 'law'
}

const KIND_LABEL = {
  observed: 'Observed',
  derived: 'Derived',
  law: 'Code',
} as const

/** Provenance chip plus a Sources control. Catalog links appear on hover or focus. */
export function SourceCite({ sources, ids, kind }: SourceCiteProps) {
  const cited = citeSources(sources, ids)
  const menuId = useId()
  const anchor = `cite${menuId.replace(/:/g, '')}`

  if (cited.length === 0) return null

  return (
    <span className="source-cite">
      {kind ? <span className={`provenance ${kind}`}>{KIND_LABEL[kind]}</span> : null}
      <span className="source-cite__hover">
        <button
          className="source-cite__trigger"
          type="button"
          aria-controls={menuId}
          style={{ anchorName: `--${anchor}` }}
        >
          Sources
        </button>
        <span
          id={menuId}
          className="source-cite__menu"
          role="group"
          aria-label="Sources"
          style={{ positionAnchor: `--${anchor}` }}
        >
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
        </span>
      </span>
    </span>
  )
}
