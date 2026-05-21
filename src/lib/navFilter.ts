import type { NavItem } from '@/layout/types'
import { pageKeyFromPathname } from '@/lib/permissions'

const PATH_OVERRIDES: Record<string, string> = {
  '/organization': 'organization.departments',
  '/performance': 'performance.records',
  '/analytics': 'analytics.monitoring',
  '/admin': 'admin.settings',
}

function pageKeyForNavPath(path: string): string | null {
  const override = PATH_OVERRIDES[path]
  if (override) return override
  return pageKeyFromPathname(path)
}

export function filterNavItems(
  items: NavItem[],
  canAccessPage: (pageKey: string) => boolean,
  options?: { includeUserManagement?: boolean },
): NavItem[] {
  const result: NavItem[] = []

  for (const item of items) {
    if (item.path === '/admin/access') {
      if (!options?.includeUserManagement) continue
      if (!canAccessPage('admin.access')) continue
      result.push(item)
      continue
    }

    if (item.children?.length) {
      const children = item.children.filter((child) => {
        const key = pageKeyForNavPath(child.path)
        return key ? canAccessPage(key) : true
      })
      if (children.length === 0) continue
      result.push({ ...item, children })
      continue
    }

    const key = pageKeyForNavPath(item.path)
    if (key && !canAccessPage(key)) continue
    result.push(item)
  }

  return result
}
