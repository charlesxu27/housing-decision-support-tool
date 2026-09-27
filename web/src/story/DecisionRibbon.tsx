import { useId, type CSSProperties } from 'react'
import { STATUS_COLORS, rgbCss } from '../map/colors'
import './story.css'

export type DecisionBand = 'high' | 'medium' | 'low' | 'uncertain'

export type DecisionAllowedStatus =
  | 'by_right'
  | 'special_exception'
  | 'conditional_use'
  | 'not_permitted'
  | 'unknown'

export type DecisionActionStatus =
  | 'ready_match'
  | 'needs_approval'
  | 'blocked_by_zoning'
  | 'needed_but_hard'
  | 'low_priority'
  | 'zoning_unknown'
  | 'not_recommended'
  | 'insufficient_data'

export interface DecisionRibbonProps {
  placeName: string
  typeLabel: string
  need: DecisionBand
  fit: DecisionBand
  allowed: DecisionAllowedStatus
  action: DecisionActionStatus
  /** Replaces the default fit sentence when the ribbon is scoped to one lot. */
  fitExplanation?: string
  className?: string
}

interface StoryStep {
  key: 'need' | 'fit' | 'allowed' | 'action'
  label: string
  question: string
  value: string
  explanation: string
  tone: string
}

const BAND_LABELS: Record<DecisionBand, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  uncertain: 'Uncertain',
}

const NEED_EXPLANATIONS: Record<DecisionBand, string> = {
  high: 'The local housing gap points to a strong need.',
  medium: 'The local housing gap suggests a meaningful need.',
  low: 'Other housing types may address the local gap better.',
  uncertain: 'The available evidence cannot establish need yet.',
}

const FIT_EXPLANATIONS: Record<DecisionBand, string> = {
  high: 'Many local sites appear physically promising.',
  medium: 'Some local sites appear physically workable.',
  low: 'Few sites appear workable without major constraints.',
  uncertain: 'Site conditions are not complete enough to judge.',
}

const ALLOWED_CONTENT: Record<
  DecisionAllowedStatus,
  { label: string; explanation: string; tone: string }
> = {
  by_right: {
    label: 'By right',
    explanation: 'Current rules appear to allow this path directly.',
    tone: 'positive',
  },
  special_exception: {
    label: 'Special exception',
    explanation: 'A review and specific findings would be required.',
    tone: 'caution',
  },
  conditional_use: {
    label: 'Conditional use',
    explanation: 'Approval would depend on a public review process.',
    tone: 'caution',
  },
  not_permitted: {
    label: 'Not permitted',
    explanation: 'Current rules appear to block this housing type.',
    tone: 'blocked',
  },
  unknown: {
    label: 'Unknown',
    explanation: 'The controlling zoning rule still needs verification.',
    tone: 'unknown',
  },
}

const ACTION_CONTENT: Record<
  DecisionActionStatus,
  { label: string; explanation: string; tone: string }
> = {
  ready_match: {
    label: 'Ready to explore',
    explanation: 'Need, site fit, and rules point in the same direction.',
    tone: 'positive',
  },
  needs_approval: {
    label: 'Plan for approval',
    explanation: 'The idea looks promising, with a review step ahead.',
    tone: 'caution',
  },
  blocked_by_zoning: {
    label: 'Address the rules',
    explanation: 'Need and fit may align, but current zoning does not.',
    tone: 'blocked',
  },
  needed_but_hard: {
    label: 'Solve site barriers',
    explanation: 'The need is present, but physical fit is limited.',
    tone: 'info',
  },
  low_priority: {
    label: 'Consider other types',
    explanation: 'This type is not the strongest response to local need.',
    tone: 'quiet',
  },
  zoning_unknown: {
    label: 'Verify zoning',
    explanation: 'Confirm the rules before treating this as actionable.',
    tone: 'unknown',
  },
  not_recommended: {
    label: 'Do not advance',
    explanation: 'A hard constraint makes this path unsuitable.',
    tone: 'danger',
  },
  insufficient_data: {
    label: 'Fill the evidence gap',
    explanation: 'More reliable facts are needed before choosing a path.',
    tone: 'missing',
  },
}

function bandTone(band: DecisionBand): string {
  if (band === 'uncertain') return 'unknown'
  if (band === 'high') return 'strong'
  if (band === 'medium') return 'moderate'
  return 'quiet'
}

export function DecisionRibbon({
  placeName,
  typeLabel,
  need,
  fit,
  allowed,
  action,
  fitExplanation,
  className,
}: DecisionRibbonProps) {
  const headingId = useId()
  const allowedContent = ALLOWED_CONTENT[allowed]
  const actionContent = ACTION_CONTENT[action]
  const steps: StoryStep[] = [
    {
      key: 'need',
      label: 'Need',
      question: 'Is there a local gap?',
      value: BAND_LABELS[need],
      explanation: NEED_EXPLANATIONS[need],
      tone: bandTone(need),
    },
    {
      key: 'fit',
      label: 'Fit',
      question: 'Could it work here?',
      value: BAND_LABELS[fit],
      explanation: fitExplanation ?? FIT_EXPLANATIONS[fit],
      tone: bandTone(fit),
    },
    {
      key: 'allowed',
      label: 'Allowed',
      question: 'What do the rules say?',
      value: allowedContent.label,
      explanation: allowedContent.explanation,
      tone: allowedContent.tone,
    },
    {
      key: 'action',
      label: 'Action',
      question: 'What comes next?',
      value: actionContent.label,
      explanation: actionContent.explanation,
      tone: actionContent.tone,
    },
  ]

  return (
    <section
      className={['story-ribbon', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <header className="story-ribbon__header">
        <div>
          <p className="story-kicker">Decision path</p>
          <h2 id={headingId}>{typeLabel}</h2>
        </div>
        <p className="story-ribbon__place">
          <span aria-hidden="true">⌖</span> {placeName}
        </p>
      </header>

      <ol className="story-ribbon__steps">
        {steps.map((step, index) => (
          <li
            className={`story-ribbon__step story-ribbon__step--${step.key}`}
            key={step.key}
            style={
              step.key === 'action'
                ? ({ '--story-accent': rgbCss(STATUS_COLORS[action]) } as CSSProperties)
                : undefined
            }
          >
            <div className="story-ribbon__step-heading">
              <span className="story-ribbon__number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{step.label}</h3>
                <p>{step.question}</p>
              </div>
            </div>
            <p
              className={`story-ribbon__value story-tone--${step.tone}`}
              aria-label={`${step.label}: ${step.value}`}
            >
              {step.value}
            </p>
            <p className="story-ribbon__explanation">{step.explanation}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
