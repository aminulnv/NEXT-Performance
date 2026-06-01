export type GoalRecord = {
  id: string
  employee_id: string | null
  employee_name: string | null
  owner: string | null
  owner_full_name: string | null
  cycle_name: string | null
  review_cycle: string | null
  title: string | null
  status: string | null
  progress: string | null
  goal_id: string | null
  approval_status: string | null
  organisation_unit: string | null
  organisation_name: string | null
  current_value: string | null
  initial_value: string | null
  submitted_at: string | null
  approved_at: string | null
  fields: Record<string, string>
}

export type GoalsColumnMap = {
  employeeId: string | null
  employeeName: string | null
  owner: string | null
  ownerFullName: string | null
  cycleName: string | null
  title: string | null
  status: string | null
  progress: string | null
  goalId: string | null
  approvalStatus: string | null
  organisationUnit: string | null
  organisationName: string | null
  currentValue: string | null
  initialValue: string | null
  submittedAt: string | null
  approvedAt: string | null
}

export type GoalsDataset = {
  goals: GoalRecord[]
  columns: string[]
  columnMap: GoalsColumnMap
  importedAt: string | null
  source: string | null
  sourcePath?: string
  hint?: string
  goalCount: number
}
