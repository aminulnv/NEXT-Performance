export type EmployeeDirectoryEntry = {
  id: string
  remoteId: string | null
  name: string
  fullName: string | null
  firstName: string | null
  middleName: string | null
  lastName: string | null
  email: string | null
  avatar: string | null
  department: string | null
  team: string | null
  location: string | null
  entity: string | null
  joiningDateTime: string | null
  terminationDateTime: string | null
  updatedDateTime: string | null
  status: string | null
  inactivityReason: string | null
  specialisation: string | null
  seniority: string | null
  candidateId: string | null
  lineManagerId: string | null
  lineManagerName: string | null
  lineManagerEmail: string | null
  /** Full Revolut /employees payload (when loaded live or from Supabase profile column). */
  profile?: Record<string, unknown> | null
}
