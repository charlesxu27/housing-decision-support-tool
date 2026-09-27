import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  EMPTY_PLANNING_ANSWERS,
  type PlanningAnswers,
  type PlanningHandoff,
} from './planning'

interface PlanningStore {
  answers: PlanningAnswers
  handoff: PlanningHandoff | null
  updateAnswers: (updates: Partial<PlanningAnswers>) => void
  setHandoff: (handoff: PlanningHandoff) => void
  reset: () => void
}

export const usePlanningStore = create<PlanningStore>()(
  persist(
    (set) => ({
      answers: EMPTY_PLANNING_ANSWERS,
      handoff: null,
      updateAnswers: (updates) =>
        set((state) => ({
          answers: { ...state.answers, ...updates },
        })),
      setHandoff: (handoff) =>
        set({ answers: handoff.answers, handoff }),
      reset: () =>
        set({
          answers: EMPTY_PLANNING_ANSWERS,
          handoff: null,
        }),
    }),
    {
      name: 'housing-match-planning',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ answers, handoff }) => ({ answers, handoff }),
    },
  ),
)
