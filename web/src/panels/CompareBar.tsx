import { COMPARE_LIMIT, compareKindLabel, type CompareKind, type CompareRef } from '../model/compare'

interface CompareBarProps {
  items: readonly CompareRef[]
  labels: readonly string[]
  currentLabel: string
  currentKind: CompareKind
  addDisabledReason: string | null
  currentAlreadyAdded: boolean
  clickToAdd: boolean
  onClickToAddChange: (value: boolean) => void
  onAddCurrent: () => void
  onRemove: (item: CompareRef) => void
  onClear: () => void
  onCompare: () => void
}

export function CompareBar({
  items,
  labels,
  currentLabel,
  currentKind,
  addDisabledReason,
  currentAlreadyAdded,
  clickToAdd,
  onClickToAddChange,
  onAddCurrent,
  onRemove,
  onClear,
  onCompare,
}: CompareBarProps) {
  const kind = items[0]?.kind ?? currentKind
  const canCompare = items.length >= 2

  return (
    <section className="compare-bar" aria-label="Compare places">
      <div className="compare-bar__intro">
        <p className="eyebrow">Compare places</p>
        <p>
          Add up to {COMPARE_LIMIT} {compareKindLabel(kind)} and rank them under your
          values. Facts stay fixed.
        </p>
      </div>

      <div className="compare-bar__slots">
        {items.length === 0 ? (
          <p className="compare-bar__empty">No places added yet.</p>
        ) : (
          <ul>
            {items.map((item, index) => (
              <li key={item.kind === 'tract' ? item.id : item.pin}>
                <span>{labels[index]}</span>
                <button
                  type="button"
                  aria-label={`Remove ${labels[index]} from comparison`}
                  onClick={() => onRemove(item)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="compare-bar__actions">
        <label className="compare-bar__mode">
          <input
            type="checkbox"
            checked={clickToAdd}
            onChange={(event) => onClickToAddChange(event.target.checked)}
          />
          Enable comparison
        </label>
        <button
          className="button button-secondary button-small"
          type="button"
          disabled={Boolean(addDisabledReason) || currentAlreadyAdded}
          title={addDisabledReason ?? undefined}
          onClick={onAddCurrent}
        >
          {currentAlreadyAdded ? 'Already added' : `Add ${currentLabel}`}
        </button>
        <button
          className="button button-small"
          type="button"
          disabled={!canCompare}
          onClick={onCompare}
        >
          {canCompare
            ? `Compare ${items.length} ${compareKindLabel(kind, items.length)}`
            : 'Compare'}
        </button>
        {items.length > 0 ? (
          <button className="button button-secondary button-small" type="button" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      {addDisabledReason && !currentAlreadyAdded ? (
        <p className="compare-bar__note">{addDisabledReason}</p>
      ) : null}
    </section>
  )
}
