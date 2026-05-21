import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'

type MetricInfoProps = {
  text: string
}

/** Only one metric tooltip open at a time (avoids stacked tips in tight table headers). */
let closeActiveTooltip: (() => void) | null = null

export function MetricInfo({ text }: MetricInfoProps) {
  const tipId = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  const hide = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    setVisible(false)
    if (closeActiveTooltip === hide) closeActiveTooltip = null
  }, [])

  const updatePosition = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords({ top: rect.top - 6, left: rect.left + rect.width / 2 })
  }, [])

  const show = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null
      closeActiveTooltip?.()
      closeActiveTooltip = hide
      updatePosition()
      setVisible(true)
    }, 120)
  }, [hide, updatePosition])

  useEffect(() => () => hide(), [hide])

  return (
    <span className="pd-metric-info">
      <button
        ref={btnRef}
        type="button"
        className="pd-metric-info-btn"
        aria-label={`About: ${text}`}
        aria-describedby={visible ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Info size={14} strokeWidth={2} aria-hidden />
      </button>
      {visible ? (
        <span
          id={tipId}
          className="pd-metric-info-tip pd-metric-info-tip--above"
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}

export function MetricTermLabel({
  label,
  help,
  className,
}: {
  label: string
  help: string
  className?: string
}) {
  return (
    <span className={className ? `pd-metric-term ${className}` : 'pd-metric-term'}>
      <span>{label}</span>
      <MetricInfo text={help} />
    </span>
  )
}
