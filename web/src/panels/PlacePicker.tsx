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

const MAX_RESULTS = 12

function normalize(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()
}

interface Group {
  kind: SummaryArea['kind']
  heading: string
  items: SummaryArea[]
}

/**
 * Searchable combobox over municipalities and Pittsburgh neighborhoods.
 * Results are grouped by kind and limited so hundreds of places stay usable.
 */
export function PlacePicker({
  id,
  label,
  summaries,
  value,
  displayValue,
  placeholder = 'Search municipalities and neighborhoods',
  onChange,
}: PlacePickerProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listId = `${inputId}-listbox`
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () =>
      [...summaries].sort(
        (left, right) =>
          left.kind.localeCompare(right.kind) ||
          left.label.localeCompare(right.label),
      ),
    [summaries],
  )

  const results = useMemo(() => {
    const needle = normalize(query ?? '')
    const matches = needle
      ? sorted.filter((summary) => {
          const haystack = normalize(`${summary.label} ${summary.municipality}`)
          return haystack.includes(needle)
        })
      : sorted
    const ranked = needle
      ? [...matches].sort((left, right) => {
          const leftStarts = normalize(left.label).startsWith(needle) ? 0 : 1
          const rightStarts = normalize(right.label).startsWith(needle) ? 0 : 1
          return leftStarts - rightStarts
        })
      : matches
    return ranked.slice(0, MAX_RESULTS)
  }, [query, sorted])

  const groups = useMemo<Group[]>(() => {
    const municipalities = results.filter((item) => item.kind === 'municipality')
    const neighborhoods = results.filter((item) => item.kind === 'neighborhood')
    const output: Group[] = []
    if (municipalities.length > 0) {
      output.push({ kind: 'municipality', heading: 'Municipalities', items: municipalities })
    }
    if (neighborhoods.length > 0) {
      output.push({
        kind: 'neighborhood',
        heading: 'Pittsburgh neighborhoods',
        items: neighborhoods,
      })
    }
    return output
  }, [results])

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups])

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

  const activeItem = flat[activeIndex]

  return (
    <div className="place-picker" ref={rootRef}>
      <label htmlFor={inputId}>{label}</label>
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
        placeholder={placeholder}
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
            setActiveIndex((index) => Math.min(flat.length - 1, index + 1))
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
        <ul className="place-picker__list" id={listId} role="listbox">
          {flat.length === 0 ? (
            <li className="place-picker__empty" role="presentation">
              No places match "{query}".
            </li>
          ) : (
            groups.map((group) => (
              <li key={group.kind} role="presentation">
                <p className="place-picker__group">{group.heading}</p>
                <ul role="group" aria-label={group.heading}>
                  {group.items.map((summary) => {
                    const index = flat.indexOf(summary)
                    return (
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
                            ? summary.municipality
                            : `${summary.members.length} tract${summary.members.length === 1 ? '' : 's'}`}
                        </small>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
