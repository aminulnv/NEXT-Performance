import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItemChild } from './types'
import { assets } from '@/config/assets'

type Props = {
  items: NavItemChild[]
  compact?: boolean
}

type IndicatorStyle = {
  left: number
  width: number
  height: number
  top: number
}

function isItemActive(path: string, pathname: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

function hasNestedSibling(items: NavItemChild[], path: string): boolean {
  return items.some((item) => item.path !== path && item.path.startsWith(`${path}/`))
}

/** Prefer the most specific tab when paths share a prefix (e.g. /goals vs /goals/analytics). */
function resolveActiveSubNavPath(items: NavItemChild[], pathname: string): string | undefined {
  let best: { path: string; length: number } | undefined

  for (const item of items) {
    if (!isItemActive(item.path, pathname)) continue
    if (!best || item.path.length > best.length) {
      best = { path: item.path, length: item.path.length }
    }
  }

  return best?.path
}

export function TopBarSubNav({ items, compact = false }: Props) {
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>())
  const [indicator, setIndicator] = useState<IndicatorStyle | null>(null)
  const [indicatorReady, setIndicatorReady] = useState(false)

  const activePath = resolveActiveSubNavPath(items, pathname) ?? items[0]?.path

  const updateIndicator = useCallback(() => {
    const nav = navRef.current
    const link = activePath ? linkRefs.current.get(activePath) : undefined
    if (!nav || !link) return

    setIndicator({
      left: link.offsetLeft,
      width: link.offsetWidth,
      height: link.offsetHeight,
      top: link.offsetTop,
    })
    setIndicatorReady(true)
  }, [activePath])

  useLayoutEffect(() => {
    updateIndicator()
  }, [updateIndicator, pathname, items, compact])

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const observer = new ResizeObserver(() => updateIndicator())
    observer.observe(nav)
    for (const link of linkRefs.current.values()) {
      observer.observe(link)
    }

    nav.addEventListener('scroll', updateIndicator, { passive: true })
    window.addEventListener('resize', updateIndicator)

    return () => {
      observer.disconnect()
      nav.removeEventListener('scroll', updateIndicator)
      window.removeEventListener('resize', updateIndicator)
    }
  }, [updateIndicator, items.length])

  if (items.length === 0) return null

  const gap = compact ? '0.125rem' : '0.25rem'
  const linkPadding = compact ? '0.375rem 0.625rem' : '0.4375rem 0.75rem'
  const linkGap = compact ? '0.3125rem' : '0.375rem'
  const fontSize = compact ? '0.75rem' : '0.8125rem'

  return (
    <nav
      ref={navRef}
      data-tour="topbar-subnav"
      aria-label="Section navigation"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap,
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: compact ? undefined : 1,
        minWidth: 0,
        maxWidth: '100%',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {indicator && (
        <span
          className="topbar-subnav-indicator"
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: indicator.top,
            width: indicator.width,
            height: indicator.height,
            borderRadius: '0.4375rem',
            background: assets.themePrimaryLight,
            opacity: indicatorReady ? 1 : 0,
            transform: `translate3d(${indicator.left}px, 0, 0)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {items.map((item) => {
        const active = item.path === activePath
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            className="topbar-subnav-link"
            ref={(el) => {
              if (el) linkRefs.current.set(item.path, el)
              else linkRefs.current.delete(item.path)
            }}
            to={item.path}
            end={hasNestedSibling(items, item.path)}
            style={{
              position: 'relative',
              zIndex: 1,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: linkGap,
              padding: linkPadding,
              borderRadius: '0.4375rem',
              fontSize,
              fontWeight: active ? 600 : 500,
              color: active ? assets.themePrimary : '#6B7280',
              background: 'transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon
              size={compact ? 14 : 15}
              strokeWidth={1.75}
              style={{ flexShrink: 0, color: 'currentColor' }}
              aria-hidden
            />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
