// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Legend } from './Legend'

afterEach(() => {
  cleanup()
})

describe('Legend', () => {
  it('groups missing facts and unloaded tracts with zoning unknown', () => {
    render(<Legend mode="match" />)

    expect(screen.getByText('Zoning unknown')).toBeTruthy()
    expect(screen.getByText(/missing required fact/)).toBeTruthy()
    expect(screen.queryByText('Insufficient data')).toBeNull()
    expect(screen.queryByText('No loaded tracts')).toBeNull()
  })

  it('keeps unloaded tracts visible on the need legend', () => {
    render(<Legend mode="need" />)

    expect(screen.getByText('No loaded tracts')).toBeTruthy()
    expect(screen.queryByText(/missing required fact/)).toBeNull()
  })
})
