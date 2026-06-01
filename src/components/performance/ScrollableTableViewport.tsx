import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type ScrollableTableViewportProps = {
  children: ReactNode
  className?: string
  /** Accessible label for the scroll region (e.g. list title). */
  label?: string
}

/** Fixed-height scroll area so long tables do not stretch the page layout. */
export function ScrollableTableViewport({
  children,
  className,
  label,
}: ScrollableTableViewportProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  const syncOverflow = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    syncOverflow()

    const observer = new ResizeObserver(syncOverflow)
    observer.observe(el)
    for (const child of el.children) {
      observer.observe(child)
    }

    return () => observer.disconnect()
  }, [syncOverflow, children])

  return (
    <div className="pd-scroll-list-shell">
      <div
        ref={scrollRef}
        className={[
          'pd-scroll-list',
          overflows ? 'pd-scroll-list--overflowing' : 'pd-scroll-list--fits',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        role="region"
        aria-label={label}
        tabIndex={overflows ? 0 : undefined}
      >
        {children}
      </div>
    </div>
  )
}
