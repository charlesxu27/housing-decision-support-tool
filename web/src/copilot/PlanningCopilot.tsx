import { useId, useMemo, useState, type FormEvent } from 'react'
import type { AreaRecord, MatchStatus, TypeId } from '../data/types'
import { areaLabel } from '../model/area'
import { buildGroundedAnswer } from './answers'
import { SUGGESTED_PROMPTS } from './knowledge'
import './PlanningCopilot.css'

export interface PlanningCopilotProps {
  selectedArea: AreaRecord | null
  selectedType: TypeId
  matchStatus?: MatchStatus
  zoningDraft?: boolean
  /** Short data-vintage line, e.g. "ACS 2020-2024 · built 27 Sep 2026". */
  dataVintage?: string
}

export function PlanningCopilot({
  selectedArea,
  selectedType,
  matchStatus,
  zoningDraft = false,
  dataVintage,
}: PlanningCopilotProps) {
  const titleId = useId()
  const descriptionId = useId()
  const queryId = useId()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)

  const answer = useMemo(() => {
    if (!selectedArea || !submittedQuery) return null

    return buildGroundedAnswer({
      query: submittedQuery,
      selectedArea,
      selectedType,
      matchStatus,
      zoningDraft,
    })
  }, [matchStatus, selectedArea, selectedType, submittedQuery, zoningDraft])

  function ask(prompt: string) {
    setQuery(prompt)
    setSubmittedQuery(prompt)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = query.trim()

    if (nextQuery && selectedArea) {
      setSubmittedQuery(nextQuery)
    }
  }

  const placeName = selectedArea
    ? areaLabel(selectedArea)
    : 'No map area selected'

  return (
    <section
      className="planning-copilot"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <header className="planning-copilot__header">
        <div className="planning-copilot__identity">
          <span className="planning-copilot__mark" aria-hidden="true">
            ✦
          </span>
          <div>
            <p className="planning-copilot__eyebrow">Planning copilot</p>
            <h2 id={titleId}>Explore the evidence</h2>
          </div>
        </div>
        <span className="planning-copilot__preview-badge">
          <span aria-hidden="true" />
          Grounded preview
        </span>
      </header>

      <p id={descriptionId} className="planning-copilot__intro">
        A deterministic local preview that retrieves planning notes. It is not
        an LLM and does not generate planning advice.
      </p>

      <aside className="planning-copilot__coverage-note" aria-label="Data coverage">
        <strong>Coverage</strong>
        <span>
          Need and Fit cover Allegheny County tracts. Allowed is computed only
          inside Pittsburgh{zoningDraft ? ' from a draft, not human-verified, zoning matrix' : ''};
          elsewhere zoning is unknown. Screening only, not a basis for zoning
          decisions.
        </span>
        <span className="planning-copilot__source-tag">
          {dataVintage ? `Data: ${dataVintage}` : 'Loaded snapshot'}
        </span>
      </aside>

      <div className="planning-copilot__context" aria-label="Current map context">
        <span className="planning-copilot__context-dot" aria-hidden="true" />
        <div>
          <span>Asking about</span>
          <strong>{placeName}</strong>
        </div>
      </div>

      {!selectedArea ? (
        <div className="planning-copilot__empty" role="status">
          <span aria-hidden="true">⌖</span>
          <h3>Select a place to begin</h3>
          <p>
            Choose a tract to ground questions in its Need, Fit, Allowed, and
            hazard values.
          </p>
        </div>
      ) : (
        <>
          <form
            className="planning-copilot__form"
            aria-label="Ask the planning copilot"
            onSubmit={handleSubmit}
          >
            <label htmlFor={queryId}>Ask a planning question</label>
            <div className="planning-copilot__query-row">
              <input
                id={queryId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. What zoning checks remain?"
                autoComplete="off"
              />
              <button type="submit" disabled={!query.trim()}>
                Ask
                <span aria-hidden="true">↑</span>
              </button>
            </div>
          </form>

          <div className="planning-copilot__suggestions">
            <p>Suggested follow-ups</p>
            <div>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {answer ? (
            <article
              className={`planning-copilot__answer planning-copilot__answer--${answer.status}`}
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="planning-copilot__answer-heading">
                <div>
                  <p className="planning-copilot__eyebrow">
                    {answer.status === 'answer'
                      ? 'Retrieved response'
                      : 'Source check'}
                  </p>
                  <h3>{answer.title}</h3>
                </div>
                <span>{answer.sourceCheckLabel}</span>
              </div>

              {answer.sections.map((section) => (
                <section
                  className="planning-copilot__answer-section"
                  key={section.heading}
                >
                  <h4>{section.heading}</h4>
                  <p>{section.text}</p>
                  {section.citationIds.length > 0 ? (
                    <div
                      className="planning-copilot__citations"
                      aria-label={`Sources for ${section.heading}`}
                    >
                      {section.citationIds.map((citationId) => {
                        const citation = answer.citations.find(
                          (item) => item.id === citationId,
                        )

                        return citation ? (
                          <span key={citation.id}>[{citation.label}]</span>
                        ) : null
                      })}
                    </div>
                  ) : (
                    <p className="planning-copilot__no-source">
                      [No matching local source]
                    </p>
                  )}
                </section>
              ))}

              {answer.citations.length > 0 ? (
                <footer>
                  <strong>Sources used</strong>
                  <ul>
                    {answer.citations.map((citation) => (
                      <li key={citation.id}>[{citation.label}]</li>
                    ))}
                  </ul>
                </footer>
              ) : null}
            </article>
          ) : (
            <div className="planning-copilot__starter" role="status">
              <span aria-hidden="true">⌁</span>
              <p>
                Ask a question or choose a prompt. Answers quote only the local
                corpus and the selected tract.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
