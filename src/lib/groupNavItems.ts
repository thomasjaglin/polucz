import type { PageId } from '../data/types'

export type NavGroup =
  | { type: 'pill'; ids: PageId[] }
  | { type: 'active'; id: PageId }

export function groupNavItems(pageOrder: PageId[], activeId: PageId): NavGroup[] {
  const groups: NavGroup[] = []
  let accumulated: PageId[] = []

  for (const id of pageOrder) {
    if (id === activeId) {
      if (accumulated.length > 0) {
        groups.push({ type: 'pill', ids: accumulated })
        accumulated = []
      }
      groups.push({ type: 'active', id })
    } else {
      accumulated.push(id)
    }
  }

  if (accumulated.length > 0) {
    groups.push({ type: 'pill', ids: accumulated })
  }

  return groups
}
