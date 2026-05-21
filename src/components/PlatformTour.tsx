import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useTour } from '@/contexts/TourContext'
import { useAuth } from '@/contexts/AuthContext'
import { assets } from '@/config/assets'
import { routes } from '@/lib/routes'
import '@/styles/platform-tour.css'

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 8
const TOOLTIP_GAP = 14

function measureTarget(selector: string | undefined): Rect | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 1 && r.height < 1) return null
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
}

function tooltipPosition(
  rect: Rect | null,
  placement: 'center' | 'right' | 'bottom' | 'top',
): React.CSSProperties {
  if (!rect || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '22rem',
    }
  }

  if (placement === 'right') {
    const left = rect.left + rect.width + TOOLTIP_GAP
    const top = Math.min(
      Math.max(rect.top, 16),
      window.innerHeight - 280,
    )
    return {
      top,
      left: Math.min(left, window.innerWidth - 320),
      maxWidth: '18rem',
    }
  }

  if (placement === 'bottom') {
    return {
      top: rect.top + rect.height + TOOLTIP_GAP,
      left: Math.min(Math.max(rect.left, 16), window.innerWidth - 320),
      maxWidth: '18rem',
    }
  }

  return {
    top: Math.max(rect.top - TOOLTIP_GAP - 200, 16),
    left: Math.min(Math.max(rect.left, 16), window.innerWidth - 320),
    maxWidth: '18rem',
  }
}

export function PlatformTour() {
  const {
    active,
    currentStep,
    stepIndex,
    totalSteps,
    next,
    back,
    skip,
  } = useTour()
  const { canAccessPage } = useAuth()

  const navigate = useNavigate()
  const [spotlight, setSpotlight] = useState<Rect | null>(null)

  const tourNavigateTo = (() => {
    if (!currentStep?.navigateTo) return null
    if (currentStep.navigateTo === routes.performance.records) {
      if (canAccessPage('performance.records')) return routes.performance.records
      if (canAccessPage('performance.cycles')) return routes.performance.cycles
    }
    return currentStep.navigateTo
  })()

  useEffect(() => {
    if (!active || !tourNavigateTo) return
    navigate(tourNavigateTo)
  }, [active, currentStep?.id, tourNavigateTo, navigate])

  const updateSpotlight = useCallback(() => {
    if (!currentStep?.target) {
      setSpotlight(null)
      return
    }
    setSpotlight(measureTarget(currentStep.target))
  }, [currentStep?.target])

  useLayoutEffect(() => {
    if (!active) return
    let cancelled = false
    const measure = () => {
      if (!cancelled) updateSpotlight()
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(measure)
    })
    const retry = tourNavigateTo ? window.setTimeout(measure, 120) : undefined
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (retry != null) window.clearTimeout(retry)
    }
  }, [active, currentStep?.id, tourNavigateTo, updateSpotlight])

  useEffect(() => {
    if (!active) return
    const onResize = () => updateSpotlight()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [active, updateSpotlight])

  if (!active || !currentStep) return null

  const placement = currentStep.placement ?? (currentStep.target ? 'right' : 'center')
  const isLast = stepIndex >= totalSteps - 1
  const progress = `${stepIndex + 1} / ${totalSteps}`

  return createPortal(
    <div className="pd-tour-root" role="dialog" aria-modal="true" aria-labelledby="pd-tour-title">
      {!spotlight ? (
        <div className="pd-tour-backdrop" onClick={skip} aria-hidden />
      ) : null}
      {spotlight ? (
        <button
          type="button"
          className="pd-tour-spotlight-hit"
          onClick={skip}
          aria-label="Skip tour"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : null}
      <div
        className="pd-tour-card"
        style={tooltipPosition(spotlight, placement)}
      >
        <div className="pd-tour-card-header">
          <span className="pd-tour-progress">{progress}</span>
          <button
            type="button"
            className="pd-tour-skip"
            onClick={skip}
            aria-label="Skip tour"
          >
            Skip tour
          </button>
          <button
            type="button"
            className="pd-tour-close"
            onClick={skip}
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>
        <h2 id="pd-tour-title" className="pd-tour-title">
          {currentStep.title}
        </h2>
        <p className="pd-tour-body">{currentStep.body}</p>
        <div className="pd-tour-actions">
          <button
            type="button"
            className="pd-tour-btn-secondary"
            onClick={skip}
          >
            Skip
          </button>
          <div className="pd-tour-actions-primary">
            {stepIndex > 0 ? (
              <button type="button" className="pd-tour-btn-secondary" onClick={back}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="pd-tour-btn-primary"
              onClick={next}
              style={{ background: assets.themePrimary }}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
