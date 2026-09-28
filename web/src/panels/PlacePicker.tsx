import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { SummaryArea } from '../data/types'

interface PlacePickerProps {
  id?: string
  label: string
  summaries: readonly SummaryArea[]
  /** Currently chosen summary id, if any. */
  value: string | null
  /** Text shown in the input when nothing is being typed. */
  displayValue: string
  placeholder?: string
  onChange: (summary: SummaryArea) => void
}

type PlaceKind = SummaryArea['kind']

const KIND_OPTIONS: { kind: PlaceKind; label: string; search: string }[] = [
  {
    kind: 'municipality',
    label: 'Municipalities',
    search: 'Search municipalities',
  },
  {
    kind: 'neighborhood',
    label: 'Pittsburgh neighborhoods',
    search: 'Search Pittsburgh neighborhoods',
  },
]

function normalize(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()
}

function matchesQuery(summary: SummaryArea, needle: string): boolean {
  if (!needle) return true
  return normalize(`${summary.label} ${summary.municipality}`).includes(needle)
}

/**
 * Places in one list. Municipalities and Pittsburgh neighborhoods stay in
 * separate lists so a short municipality page cannot hide the neighborhoods.
 */
function placesForKind(
  summaries: readonly SummaryArea[],
  kind: PlaceKind,
  query: string,
): SummaryArea[] {
  const needle = normalize(query)
  return summaries
    .filter((summary) => summary.kind === kind && matchesQuery(summary, needle))
    .sort((left, right) => {
      const leftStarts = needle && normalize(left.label).startsWith(needle) ? 0 : 1
      const rightStarts = needle && normalize(right.label).startsWith(needle) ? 0 : 1
      return leftStarts - rightStarts || left.label.localeCompare(right.label)
    })
}

/**
 * Two lists: Allegheny County municipalities, and neighborhoods inside the
 * City of Pittsburgh. Search applies to the list that is open.
 */
export function PlacePicker({
  id,
  label,
  summaries,
  value,
  displayValue,
  onChange,
}: PlacePickerProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listId = `${inputId}-listbox`
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [kindChoice, setKindChoice] = useState<{
    value: string | null
    kind: PlaceKind | null
  }>({ value, kind: null })
  const rootRef = useRef<HTMLDivElement>(null)

  if (kindChoice.value !== value) {
    setKindChoice({ value, kind: null })
  }

  const selectedKind =
    summaries.find((summary) => summary.id === value)?.kind ?? 'municipality'
  const kind = kindChoice.kind ?? selectedKind

  const counts = useMemo(
    () => ({
      municipality: summaries.filter((summary) => summary.kind === 'municipality').length,
      neighborhood: summaries.filter((summary) => summary.kind === 'neighborhood').length,
    }),
    [summaries],
  )

  const typed = query ?? ''
  const results = useMemo(
    () => placesForKind(summaries, kind, typed),
    [kind, summaries, typed],
  )
  const otherKind: PlaceKind = kind === 'municipality' ? 'neighborhood' : 'municipality'
  const otherMatches = useMemo(
    () => (typed ? placesForKind(summaries, otherKind, typed).length : 0),
    [otherKind, summaries, typed],
  )
  const activeKind = KIND_OPTIONS.find((option) => option.kind === kind) ?? KIND_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [open])

  const choose = (summary: SummaryArea) => {
    onChange(summary)
    setOpen(false)
    setQuery(null)
  }

  const showKind = (next: PlaceKind) => {
    setKindChoice({ value, kind: next })
    setActiveIndex(0)
    setOpen(true)
  }

  const activeItem = results[activeIndex]

  return (
    <div className="place-picker" ref={rootRef}>
      <label htmlFor={inputId}>{label}</label>
      <div className="place-picker__filters" role="tablist" aria-label="Place type">
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            role="tab"
            id={`${inputId}-${option.kind}`}
            aria-selected={kind === option.kind}
            aria-controls={listId}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => showKind(option.kind)}
          >
            <span>{option.label}</span>
            <small>{counts[option.kind]}</small>
          </button>
        ))}
      </div>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeItem ? `${listId}-${activeItem.id}` : undefined
        }
        placeholder={activeKind.search}
        value={query ?? displayValue}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((index) =>
              results.length === 0 ? 0 : Math.min(results.length - 1, index + 1),
            )
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => Math.max(0, index - 1))
          } else if (event.key === 'Enter') {
            if (open && activeItem) {
              event.preventDefault()
              choose(activeItem)
            }
          } else if (event.key === 'Escape') {
            setOpen(false)
            setQuery(null)
          }
        }}
      />
      {open ? (
        <div className="place-picker__panel">
          <ul className="place-picker__list" id={listId} role="listbox" aria-label={activeKind.label}>
            <li className="place-picker__group" role="presentation">
              {activeKind.label}
              {typed
                ? ` · ${results.length} match${results.length === 1 ? '' : 'es'}`
                : ''}
            </li>
            {results.length === 0 ? (
              <li className="place-picker__empty" role="presentation">
                No {kind === 'neighborhood' ? 'neighborhoods' : 'municipalities'} match
                "{typed}".
                {otherMatches > 0 ? (
                  <button
                    type="button"
                    className="place-picker__switch"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => showKind(otherKind)}
                  >
                    {otherKind === 'neighborhood'
                      ? `${otherMatches} Pittsburgh neighborhood${otherMatches === 1 ? '' : 's'}`
                      : `${otherMatches} ${otherMatches === 1 ? 'municipality' : 'municipalities'}`}{' '}
                    match. Show that list.
                  </button>
                ) : null}
              </li>
            ) : (
              results.map((summary, index) => (
                <li
                  key={summary.id}
                  id={`${listId}-${summary.id}`}
                  role="option"
                  aria-selected={summary.id === value}
                  className={[
                    'place-picker__option',
                    index === activeIndex ? 'place-picker__option--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    choose(summary)
                  }}
                >
                  <strong>{summary.label}</strong>
                  <small>
                    {summary.kind === 'neighborhood'
                      ? 'Pittsburgh neighborhood'
                      : `${summary.members.length} tract${summary.members.length === 1 ? '' : 's'}`}
                  </small>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
