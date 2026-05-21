import type { CSSProperties } from 'react'

/**
 * Central place for image/logo URLs and theme colors. Update these once to change them app-wide.
 *
 * Assets:
 * - logoUrl: Logo image URL (sidebar, header). Leave empty for icon-only branding.
 * - loginBackgroundValue: Login/sign-up background. Use a color (#hex, rgb), gradient
 *   (e.g. linear-gradient(...)), or image URL (http/https). CSS is applied automatically.
 * - layoutBackgroundValue: App layout background. Same options as loginBackgroundValue.
 *
 * Theme (accent) colors — see `theme` object; applied to CSS via applyThemeVariables():
 * - themePrimary / themePrimaryDark: Buttons, avatar, links, chart accents.
 * - themePrimaryLight / themePrimaryMuted: Selected cards, badges, info panels.
 * - sidebarBg / layoutBackgroundValue: App shell behind sidebar and content.
 *
 * Helper:
 * - getBackgroundStyle(value): Returns style props for a given value (image URL vs color/gradient).
 */
/** Brand palette — tuned to match the logo’s deep red on dark metal. */
export const theme = {
  primary: '#DC2626',
  primaryDark: '#B91C1C',
  primaryLight: '#FEF2F2',
  primaryMuted: '#FECACA',
  primaryContrast: '#FFFFFF',
  /** Sidebar / app shell (near-black with a subtle red undertone). */
  sidebar: '#141010',
} as const

export const assets = {
  appTitle: 'Performance Dashboard',
  logoUrl: 'https://i.postimg.cc/85T11NK7/Untitled-(1920-x-1920-px).png' as string,
  loginBackgroundValue:
    'https://i.pinimg.com/736x/21/16/59/21165977ebcdc14db9ac23044c721820.jpg',
  layoutBackgroundValue: theme.sidebar,
  sidebarBg: theme.sidebar,
  themePrimary: theme.primary,
  themePrimaryDark: theme.primaryDark,
  themePrimaryLight: theme.primaryLight,
  themePrimaryMuted: theme.primaryMuted,
  themePrimaryContrast: theme.primaryContrast,
} as const

export type AssetsConfig = typeof assets

/** Browser tab title and favicon (uses logoUrl). */
export function applyDocumentBranding() {
  document.title = assets.appTitle
  const href = assets.logoUrl?.trim()
  if (!href) return

  const setLink = (rel: string) => {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      document.head.appendChild(link)
    }
    link.type = 'image/png'
    link.href = href
  }

  setLink('icon')
  setLink('apple-touch-icon')
}

/** Sync CSS custom properties for stylesheets (performance.css, etc.). */
export function applyThemeVariables() {
  const root = document.documentElement
  root.style.setProperty('--theme-primary', theme.primary)
  root.style.setProperty('--theme-primary-dark', theme.primaryDark)
  root.style.setProperty('--theme-primary-light', theme.primaryLight)
  root.style.setProperty('--theme-primary-muted', theme.primaryMuted)
  root.style.setProperty('--theme-sidebar', theme.sidebar)
}

const isImageUrl = (v: string) => /^(https?:|\/)/.test(v.trim());

export function getBackgroundStyle(value: string): CSSProperties {
  if (!value) return {}
  if (isImageUrl(value)) {
    return {
      backgroundImage: `url('${value}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return { background: value }
}
