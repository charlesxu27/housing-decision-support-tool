import type { SummaryArea } from '../data/types'
import type { MapMode } from '../shared/mapState'
import { PlacePicker } from './PlacePicker'

interface Option {
  value: string
  label: string
}

interface ToolbarProps {
  summaries: readonly SummaryArea[]
  /** Summary area containing the selected tract, when one is known. */
  selectedSummaryId: string | null
  /** Label for the currently selected tract, e.g. "Tract 1307 · Homewood North, Pittsburgh". */
  selectedLabel: string
  onSummaryChange: (summary: SummaryArea) => void
  types: Option[]
  type: string
  onTypeChange: (value: string) => void
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  is3d: boolean
  onDimensionChange: (is3d: boolean) => void
}

export function Toolbar({
  summaries,
  selectedSummaryId,
  selectedLabel,
  onSummaryChange,
  types,
  type,
  onTypeChange,
  mode,
  onModeChange,
  is3d,
  onDimensionChange,
}: ToolbarProps) {
  return (
    <div className="toolbar" aria-label="Map controls">
      <div className="field">
        <PlacePicker
          id="place-search"
          label="Place"
          summaries={summaries}
          value={selectedSummaryId}
          displayValue={selectedLabel}
          onChange={onSummaryChange}
        />
      </div>
      <div className="field">
        <label htmlFor="type-select">Housing type</label>
        <select
          id="type-select"
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          {types.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="segmented" aria-label="Map view">
        <button
          className={mode === 'match' ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('match')}
        >
          Match status
        </button>
        <button
          className={mode === 'need' ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('need')}
        >
          What's missing
        </button>
      </div>
      <div className="segmented" aria-label="Map dimension">
        <button
          className={!is3d ? 'active' : ''}
          type="button"
          onClick={() => onDimensionChange(false)}
        >
          2D
        </button>
        <button
          className={is3d ? 'active' : ''}
          type="button"
          onClick={() => onDimensionChange(true)}
        >
          3D
        </button>
      </div>
    </div>
  )
}
