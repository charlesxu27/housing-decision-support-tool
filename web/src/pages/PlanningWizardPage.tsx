import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSnapshot } from '../data/useSnapshot'
import { TYPE_IDS } from '../data/types'
import {
  GOAL_OPTIONS,
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
    short: 'Type',
    title: 'Which housing types should we compare?',
    detail:
      'Select one or more. The map opens on the type marked “Starts the map.” You can switch types after the map opens.',
  },
] as const

export function PlanningWizardPage() {
  const navigate = useNavigate()
  const snapshot = useSnapshot()
  const { summaries, areasById } = snapshot
  const answers = usePlanningStore((state) => state.answers)
  const updateAnswers = usePlanningStore((state) => state.updateAnswers)
  const setHandoff = usePlanningStore((state) => state.setHandoff)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const current = STEPS[step]

  const continueToNext = () => {
    const nextErrors = validatePlanningStep(step, answers, summaries)
    setErrors(nextErrors)
    if (nextErrors.length > 0) return
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openMap = () => {
    const allErrors = STEPS.flatMap((_, index) =>
      validatePlanningStep(index, answers, summaries),
    )
    if (allErrors.length > 0) {
      setErrors([...new Set(allErrors)])
      return
    }

    try {
      const handoff = createPlanningHandoff(answers, summaries, areasById)
      setHandoff(handoff)
      navigate(`/map${toMapSearch(handoff.configuration)}`)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not open the map.'])
    }
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
              <div className="option-grid housing-option-grid">
                {TYPE_IDS.map((type) => {
                  const selected = answers.housingTypes.includes(type)
                  const lead = answers.housingTypes[0] === type
                  return (
                    <div className="option-card" key={type}>
                      <label>
                        <input
                          type="checkbox"
                          name="housing-types"
                          value={type}
                          checked={selected}
                          onChange={() => {
                            const housingTypes = selected
                              ? answers.housingTypes.filter((item) => item !== type)
                              : [...answers.housingTypes, type]
                            updateAnswers({ housingTypes })
                          }}
                        />
                        <span>
                          {TYPE_LABELS[type]}
                          {lead ? <small>Starts the map</small> : null}
                        </span>
                      </label>
                      {selected && answers.housingTypes.length > 1 && !lead ? (
                        <button
                          className="option-card__lead"
                          type="button"
                          onClick={() =>
                            updateAnswers({
                              housingTypes: [
                                type,
                                ...answers.housingTypes.filter((item) => item !== type),
                              ],
                            })
                          }
                        >
                          Start map here
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
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
