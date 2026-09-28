// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSummary } from '../test/builders'
import { PlacePicker } from './PlacePicker'

const municipalities = Array.from({ length: 13 }, (_, index) => {
  const label = `Place ${String(index).padStart(2, '0')}`
  return buildSummary({
    id: `muni:${index}`,
    kind: 'municipality',
    label,
    municipality: label,
  })
})

const neighborhoods = [
  buildSummary({
    id: 'hood:homewood-north',
    kind: 'neighborhood',
    label: 'Homewood North',
    municipality: 'Pittsburgh',
  }),
  buildSummary({
    id: 'hood:shadyside',
    kind: 'neighborhood',
    label: 'Shadyside',
    municipality: 'Pittsburgh',
  }),
]

afterEach(() => {
  cleanup()
})

describe('PlacePicker', () => {
  it('lists every municipality and keeps neighborhoods in their own list', () => {
    render(
      <PlacePicker
        label="Place"
        summaries={[...municipalities, ...neighborhoods]}
        value={null}
        displayValue=""
        onChange={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /Municipalities/ }))

    expect(screen.getAllByRole('option')).toHaveLength(13)
    expect(screen.getByRole('option', { name: /Place 12/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Shadyside/ })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /Pittsburgh neighborhoods/ }))

    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('option', { name: /Homewood North/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Shadyside/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Place 00/ })).toBeNull()
  })

  it('points a search at the other list when the open list has no match', () => {
    render(
      <PlacePicker
        label="Place"
        summaries={[...municipalities, ...neighborhoods]}
        value={null}
        displayValue=""
        onChange={() => undefined}
      />,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'shadyside' } })

    expect(screen.getByRole('button', { name: /Pittsburgh neighborhood match/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Show that list/ }))
    expect(screen.getByRole('option', { name: /Shadyside/ })).toBeTruthy()
  })
})
