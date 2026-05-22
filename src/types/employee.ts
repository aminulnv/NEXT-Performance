export type EmployeeDirectoryEntry = {
  id: string
  remoteId: string | null
  name: string
  email: string | null
  department: string | null
  team: string | null
  status: string | null
  lineManagerId: string | null
  lineManagerName: string | null
  lineManagerEmail: string | null
}
