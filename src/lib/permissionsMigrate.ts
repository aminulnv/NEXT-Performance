import permissionsJson from '@/config/permissions.json'
import type { PermissionsConfig } from '@/lib/permissions'

const canonicalPages = permissionsJson.pages as PermissionsConfig['pages']

function applyCanonicalPageLabels(pages: PermissionsConfig['pages']): PermissionsConfig['pages'] {
  const next = { ...pages }
  for (const [key, meta] of Object.entries(canonicalPages)) {
    if (next[key]) {
      next[key] = { ...next[key], label: meta.label }
    }
  }
  return next
}

/** One-time transforms for stored permissions config (Supabase or file). */
export function migratePermissionsConfig(config: PermissionsConfig): PermissionsConfig {
  let pages = { ...config.pages }
  const pageMigrations: Record<string, string | null> = {
    'analytics.explore': 'performance.explore',
    'analytics.reviewers': 'performance.reviewers',
    'analytics.calibration': 'performance.calibration',
    'analytics.monitoring': null,
  }

  for (const [oldKey, newKey] of Object.entries(pageMigrations)) {
    if (!pages[oldKey]) continue
    if (newKey && !pages[newKey]) {
      pages[newKey] = {
        ...pages[oldKey],
        path: pathForPageKey(newKey, pages[oldKey].path),
      }
    }
    delete pages[oldKey]
  }

  for (const [key, meta] of Object.entries(canonicalPages)) {
    if (!pages[key]) {
      pages[key] = { ...meta }
    }
  }

  pages = applyCanonicalPageLabels(pages)

  const roles: PermissionsConfig['roles'] = {}
  for (const [id, role] of Object.entries(config.roles)) {
    const nextPages = new Set<string>()
    for (const pageKey of role.pages ?? []) {
      if (pageKey === '*') {
        nextPages.add('*')
        continue
      }
      if (pageKey === 'analytics.monitoring') {
        nextPages.add('goals.analytics')
        nextPages.add('performance.analytics')
        continue
      }
      const migrated = pageMigrations[pageKey]
      if (migrated === null) continue
      if (migrated) {
        nextPages.add(migrated)
        continue
      }
      nextPages.add(pageKey)
    }
    roles[id] = { ...role, pages: [...nextPages] }
  }

  if (!roles.hrbp) {
    roles.hrbp = {
      label: 'HRBP',
      description: 'Goal program analytics only — no performance ratings',
      pages: ['goals.analytics', 'account.profile'],
      system: true,
      dataAccess: 'summary',
    }
  }

  return { ...config, pages, roles }
}

function pathForPageKey(pageKey: string, fallbackPath: string): string {
  const paths: Record<string, string> = {
    'performance.explore': '/performance/explore',
    'performance.reviewers': '/performance/reviewers',
    'performance.calibration': '/performance/calibration',
  }
  return paths[pageKey] ?? fallbackPath
}
