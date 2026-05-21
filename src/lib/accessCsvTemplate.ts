export const ACCESS_USERS_CSV_TEMPLATE = `email,role,employee_id,name
user@nextventures.io,manager,,Example Manager
other@nextventures.io,hr,,Example HR
`

export function downloadAccessUsersTemplate() {
  const blob = new Blob([ACCESS_USERS_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'dashboard-users-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}
