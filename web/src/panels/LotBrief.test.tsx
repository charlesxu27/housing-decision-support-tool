// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LotBriefBanner } from './LotBrief'

afterEach(() => {
  cleanup()
})

describe('LotBriefBanner', () => {
  it('marks a model rewrite as AI-generated', () => {
    render(<LotBriefBanner engine="openai" pending={false} model="gpt-5-nano" />)
    const note = screen.getByRole('note')
    expect(note.textContent).toContain('AI-generated summary')
    expect(note.textContent).toContain('gpt-5-nano')
    expect(note.textContent).toContain('trust the checks')
  })

  it('says the snapshot wording is not AI-generated', () => {
    render(<LotBriefBanner engine="template" pending={false} model="" />)
    expect(screen.getByText(/Not AI-generated/)).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
  })
})
