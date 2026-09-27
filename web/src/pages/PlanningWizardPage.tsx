import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ILLUSTRATIVE_HEXES } from '../data/fixtures'
import { TYPE_IDS, type TypeId } from '../data/types'
import {
  GOAL_OPTIONS,
  PRIORITY_OPTIONS,
  ROLE_OPTIONS,
  createPlanningHandoff,
  validatePlanningStep,
  type GoalId,
  type RoleId,
} from '../planning/planning'
import { usePlanningStore } from '../planning/store'
import { TYPE_LABELS } from '../shared/labels'
import { toMapSearch } from '../shared/mapState'

const STEPS = [
  {
    short: 'Context',
    title: 'Who is at the table?',
    detail:
      'Your role gives context to the planning summary. It does not change map results.',
  },
  {
    short: 'Goal',
    title: 'What do you want to understand?',
    detail:
      'Your goal chooses the first map view. You can switch views at any time.',
  },
  {
    short: 'Place',
    title: 'Choose an illustrative geography.',
    detail:
      'The choice focuses the map and report. Current places contain fixture data only.',
  },
  {
    short: 'Type',
    title: 'Which housing type should lead?',
    detail:
      'The map will start by comparing need, fit, and allowance for this type.',
  },
  {
    short: 'Priorities',
    title: 'Make the tradeoffs visible.',
    detail:
      'Priorities affect scenario ranking only. They never change map facts or legal status.',
  },
  {
    short: 'Review',
    title: 'Review your planning lens.',
    detail:
      'You can return to any step. Opening the map keeps all controls available.',
  },
] as const

function placeLabel(h3: string) {
  const place = ILLUSTRATIVE_HEXES.find((candidate) => candidate.h3 === h3)
  if (!place) return 'Not selected'
  const name = place.neighborhood ?? place.muni
  return place.neighborhood ? `${name}, ${place.muni}` : name
}

export function PlanningWizardPage() {
  const navigate = useNavigate()
  const answers = usePlanningStore((state) => state.answers)
  const updateAnswers = usePlanningStore((state) => state.updateAnswers)
  const setHandoff = usePlanningStore((state) => state.setHandoff)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const current = STEPS[step]

  const continueToNext = () => {
    const nextErrors = validatePlanningStep(
      step,
      answers,
      ILLUSTRATIVE_HEXES,
    )
    setErrors(nextErrors)
    if (nextErrors.length > 0) return
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openMap = () => {
    const allErrors = STEPS.flatMap((_, index) =>
      validatePlanningStep(index, answers, ILLUSTRATIVE_HEXES),
    )
    if (allErrors.length > 0) {
      setErrors([...new Set(allErrors)])
      return
    }

    const handoff = createPlanningHandoff(answers, ILLUSTRATIVE_HEXES)
    setHandoff(handoff)
    navigate(`/map${toMapSearch(handoff.configuration)}`)
  }

  return (
    <main className="wizard-page">
      <div className="wizard-heading">
        <div>
          <p className="page-kicker">Guided municipal planning</p>
          <h1>Build a focused map view.</h1>
        </div>
        <Link to="/map">Skip to the map</Link>
      </div>

      <div className="wizard-layout">
        <aside className="wizard-progress" aria-label="Planning progress">
          <p>
            Step {step + 1} of {STEPS.length}
          </p>
          <ol>
            {STEPS.map((item, index) => (
              <li
                className={
                  index === step
                    ? 'active'
                    : index < step
                      ? 'complete'
                      : ''
                }
                key={item.short}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (index <= step) {
                      setStep(index)
                      setErrors([])
                    }
                  }}
                  aria-current={index === step ? 'step' : undefined}
                  disabled={index > step}
                >
                  <span>{index < step ? '✓' : index + 1}</span>
                  {item.short}
                </button>
              </li>
            ))}
          </ol>
          <div className="cannot-answer">
            <strong>What this tool cannot answer</strong>
            <p>
              It cannot determine legal compliance, infrastructure capacity,
              financial feasibility, site availability, or community consent.
            </p>
          </div>
        </aside>

        <section className="wizard-card" aria-labelledby="wizard-step-heading">
          <header>
            <p className="page-kicker">
              {String(step + 1).padStart(2, '0')} · {current.short}
            </p>
            <h2 id="wizard-step-heading">{current.title}</h2>
            <p>{current.detail}</p>
          </header>

          <div className="wizard-fields">
            {step === 0 ? (
              <>
                <div className="option-grid">
                  {ROLE_OPTIONS.map((option) => (
                    <label className="option-card" key={option.value}>
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={answers.role === option.value}
                        onChange={() =>
                          updateAnswers({ role: option.value as RoleId })
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <label className="text-field">
                  <span>Decision context (optional)</span>
                  <textarea
                    value={answers.context}
                    maxLength={240}
                    rows={3}
                    onChange={(event) =>
                      updateAnswers({ context: event.target.value })
                    }
                    placeholder="For example: preparing a housing strategy workshop"
                  />
                  <small>{answers.context.length}/240 characters</small>
                </label>
              </>
            ) : null}

            {step === 1 ? (
              <div className="option-stack">
                {GOAL_OPTIONS.map((option) => (
                  <label className="option-card" key={option.value}>
                    <input
                      type="radio"
                      name="goal"
                      value={option.value}
                      checked={answers.goal === option.value}
                      onChange={() =>
                        updateAnswers({ goal: option.value as GoalId })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="option-stack">
                {ILLUSTRATIVE_HEXES.map((place) => (
                  <label className="option-card" key={place.h3}>
                    <input
                      type="radio"
                      name="place"
                      value={place.h3}
                      checked={answers.place === place.h3}
                      onChange={() => updateAnswers({ place: place.h3 })}
                    />
                    <span>
                      <strong>{place.neighborhood ?? place.muni}</strong>
                      {place.neighborhood ? <small>{place.muni}</small> : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="option-grid housing-option-grid">
                {TYPE_IDS.map((type) => (
                  <label className="option-card" key={type}>
                    <input
                      type="radio"
                      name="housing-type"
                      value={type}
                      checked={answers.housingType === type}
                      onChange={() =>
                        updateAnswers({ housingType: type as TypeId })
                      }
                    />
                    <span>{TYPE_LABELS[type]}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {step === 4 ? (
              <>
                <div className="priority-list">
                  {PRIORITY_OPTIONS.map((priority) => (
                    <label key={priority.key}>
                      <span>
                        <strong>{priority.label}</strong>
                        <output>{answers.priorities[priority.key]}</output>
                      </span>
                      <small>{priority.explanation}</small>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={answers.priorities[priority.key]}
                        onChange={(event) =>
                          updateAnswers({
                            priorities: {
                              ...answers.priorities,
                              [priority.key]: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="text-field">
                  <span>Tradeoff to keep in view (optional)</span>
                  <textarea
                    rows={3}
                    maxLength={240}
                    value={answers.tradeoff}
                    onChange={(event) =>
                      updateAnswers({ tradeoff: event.target.value })
                    }
                    placeholder="For example: add homes without displacing current renters"
                  />
                </label>
              </>
            ) : null}

            {step === 5 ? (
              <dl className="review-list">
                <div>
                  <dt>Role</dt>
                  <dd>
                    {ROLE_OPTIONS.find((option) => option.value === answers.role)
                      ?.label ?? 'Not selected'}
                  </dd>
                  <button type="button" onClick={() => setStep(0)}>
                    Edit
                  </button>
                </div>
                <div>
                  <dt>Goal</dt>
                  <dd>
                    {GOAL_OPTIONS.find((option) => option.value === answers.goal)
                      ?.label ?? 'Not selected'}
                  </dd>
                  <button type="button" onClick={() => setStep(1)}>
                    Edit
                  </button>
                </div>
                <div>
                  <dt>Geography</dt>
                  <dd>{placeLabel(answers.place)}</dd>
                  <button type="button" onClick={() => setStep(2)}>
                    Edit
                  </button>
                </div>
                <div>
                  <dt>Housing type</dt>
                  <dd>
                    {answers.housingType
                      ? TYPE_LABELS[answers.housingType]
                      : 'Not selected'}
                  </dd>
                  <button type="button" onClick={() => setStep(3)}>
                    Edit
                  </button>
                </div>
                <div>
                  <dt>Priority range</dt>
                  <dd>
                    {Math.min(...Object.values(answers.priorities))}–{Math.max(
                      ...Object.values(answers.priorities),
                    )}{' '}
                    out of 100
                  </dd>
                  <button type="button" onClick={() => setStep(4)}>
                    Edit
                  </button>
                </div>
              </dl>
            ) : null}
          </div>

          {errors.length > 0 ? (
            <div className="form-errors" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <footer className="wizard-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={step === 0}
              onClick={() => {
                setStep((value) => Math.max(0, value - 1))
                setErrors([])
              }}
            >
              Back
            </button>
            {step === STEPS.length - 1 ? (
              <button className="button" type="button" onClick={openMap}>
                Open configured map
              </button>
            ) : (
              <button className="button" type="button" onClick={continueToNext}>
                Continue
              </button>
            )}
          </footer>
        </section>
      </div>
    </main>
  )
}
