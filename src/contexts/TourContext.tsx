import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearTourDismissed,
  filterTourSteps,
  isTourDismissed,
  markTourDismissed,
  PLATFORM_TOUR_STEPS,
  type TourStep,
} from '@/lib/platformTour'

type TourContextValue = {
  steps: TourStep[]
  active: boolean
  stepIndex: number
  currentStep: TourStep | null
  totalSteps: number
  next: () => void
  back: () => void
  skip: () => void
  finish: () => void
  restart: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, loading, canAccessPage } = useAuth()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const steps = useMemo(
    () =>
      filterTourSteps(PLATFORM_TOUR_STEPS, { canAccessPage }),
    [canAccessPage],
  )

  const dismiss = useCallback(() => {
    markTourDismissed()
    setActive(false)
    setStepIndex(0)
  }, [])

  const skip = useCallback(() => {
    dismiss()
  }, [dismiss])

  const finish = useCallback(() => {
    dismiss()
  }, [dismiss])

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish()
      return
    }
    setStepIndex((i) => i + 1)
  }, [stepIndex, steps.length, finish])

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const restart = useCallback(() => {
    clearTourDismissed()
    setStepIndex(0)
    setActive(true)
  }, [])

  useEffect(() => {
    if (loading || !user) {
      setActive(false)
      return
    }
    if (!isTourDismissed()) {
      setStepIndex(0)
      setActive(true)
    }
  }, [loading, user?.id])

  const currentStep = active && steps.length > 0 ? steps[stepIndex] ?? null : null

  const value: TourContextValue = {
    steps,
    active: active && steps.length > 0,
    stepIndex,
    currentStep,
    totalSteps: steps.length,
    next,
    back,
    skip,
    finish,
    restart,
  }

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (ctx == null) {
    throw new Error('useTour must be used within TourProvider')
  }
  return ctx
}
