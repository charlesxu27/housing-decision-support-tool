// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScenarioBuilder, type ScenarioScorecard, type ValueWeights } from './ScenarioBuilder'

afterEach(() => {
  cleanup()
})

const weights: ValueWeights = {
  protectResidents: 50,
  lowCarbon: 50,
  climateSafety: 50,
  deepAffordability: 50,
  speedToBuild: 0,
}

function card(
  id: string,
  score: number,
  contributions: ScenarioScorecard['contributions'],
  excluded: ScenarioScorecard['excluded'] = [],
): ScenarioScorecard {
  return {
    id,
    label: id,
    description: '',
    homes: 40,
    householdsServed: 0.5,
    landFit: 1,
    zoningEase: 1,
    displacementSafety: 0.5,
    carbon: 0.5,
    climate: 1,
    speed: 0.5,
    score,
    contributions,
    excluded,
    facts: [],
    unavailable: [],
  }
}

describe('ScenarioBuilder', () => {
  it('names the priority that separates adjacent ranks', () => {
    render(
      <ScenarioBuilder
        placeName="Homewood North"
        targetHomes={40}
        weights={weights}
        onWeightChange={() => undefined}
        scenarios={[
          card('Transit', 0.6, {
            protectResidents: 5,
            lowCarbon: 15,
            climateSafety: 25,
            deepAffordability: 15,
            speedToBuild: 0,
          }),
          card('Gentle', 0.8, {
            protectResidents: 20,
            lowCarbon: 15,
            climateSafety: 25,
            deepAffordability: 20,
            speedToBuild: 0,
          }),
        ]}
      />,
    )

    expect(
      screen.getByText('Leads Transit by 20 points, mostly on protect existing residents (+15).'),
    ).toBeTruthy()
    expect(
      screen.getByText('Trails Gentle by 20 points, mostly on protect existing residents (−15).'),
    ).toBeTruthy()
    expect(screen.getAllByText('20 of 25').length).toBe(2)
    expect(screen.getAllByText('0 of 0').length).toBe(2)
  })

  it('marks priorities without input as not scored', () => {
    render(
      <ScenarioBuilder
        placeName="Homewood North"
        targetHomes={40}
        weights={weights}
        onWeightChange={() => undefined}
        scenarios={[
          card(
            'Gentle',
            0.7,
            {
              protectResidents: 0,
              lowCarbon: 20,
              climateSafety: 33.3,
              deepAffordability: 16.7,
              speedToBuild: 0,
            },
            ['protectResidents'],
          ),
        ]}
      />,
    )

    expect(screen.getByText('Not scored')).toBeTruthy()
    expect(screen.getByText('33 of 33')).toBeTruthy()
  })
})
