import { useId } from 'react'
import './story.css'

export interface MethodStoryProps {
  title?: string
  className?: string
}

const DIMENSIONS = [
  {
    number: '01',
    name: 'Need',
    prompt: 'What is missing?',
    detail: 'Household patterns and today’s housing supply reveal the gap.',
    source: 'Observed + derived',
  },
  {
    number: '02',
    name: 'Fit',
    prompt: 'Where could it work?',
    detail: 'Parcel conditions estimate physical capacity and constraints.',
    source: 'Observed + modeled',
  },
  {
    number: '03',
    name: 'Allowed',
    prompt: 'What do the rules permit?',
    detail: 'Verified zoning determines the current legal path.',
    source: 'Law + verification',
  },
] as const

export function MethodStory({
  title = 'Keep the questions separate',
  className,
}: MethodStoryProps) {
  const headingId = useId()

  return (
    <section
      className={['method-story', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <header className="method-story__header">
        <div>
          <p className="story-kicker">How to read the match</p>
          <h2 id={headingId}>{title}</h2>
        </div>
        <p className="method-story__lede">
          A place can need housing that is hard to site—or easy to site but
          illegal today. Combining those facts too early hides the real choice.
        </p>
      </header>

      <ol className="method-story__dimensions">
        {DIMENSIONS.map((dimension) => (
          <li className="method-story__dimension" key={dimension.name}>
            <span className="method-story__index" aria-hidden="true">
              {dimension.number}
            </span>
            <p className="method-story__prompt">{dimension.prompt}</p>
            <h3>{dimension.name}</h3>
            <p className="method-story__detail">{dimension.detail}</p>
            <p className="method-story__source">{dimension.source}</p>
          </li>
        ))}
      </ol>

      <div className="method-story__handoff">
        <div className="method-story__facts">
          <p className="story-kicker">Facts stay fixed</p>
          <p>
            Changing priorities does not rewrite household data, parcel
            conditions, hazards, or zoning.
          </p>
        </div>
        <div className="method-story__arrow" aria-hidden="true">
          <span>then</span>
          <span>→</span>
        </div>
        <div className="method-story__values">
          <p className="story-kicker">Values set the order</p>
          <p>
            Community priorities change which feasible choices rise to the
            top—not whether the underlying facts are true.
          </p>
        </div>
      </div>

      <p className="method-story__principle">
        <strong>The rule:</strong> establish the evidence, expose the
        constraints, then use values to prioritize action.
      </p>
    </section>
  )
}
