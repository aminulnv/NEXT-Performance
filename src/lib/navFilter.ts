import type { NavItem } from '@/layout/types'
import { pageKeyFromPathname } from '@/lib/permissions'

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
        const key = pageKeyFromPathname(child.path)
        return key ? canAccessPage(key) : true
      })
      if (children.length === 0) continue
      result.push({ ...item, children })
      continue
    }

    const key = pageKeyFromPathname(item.path)
    if (key && !canAccessPage(key)) continue
    result.push(item)
  }

  return result
}
