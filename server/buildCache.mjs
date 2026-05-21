import { loadRevolutPerformanceDataset } from './revolutData.mjs'
import { flattenGrades } from './flatten.mjs'
import { writeDiskCache } from './diskCache.mjs'
import { buildEmployeesByEmailFromList } from './employeeLookup.mjs'

export function getCredentials() {
  const email = process.env.REVOLUT_EMAIL
  const token = process.env.REVOLUT_TOKEN
  if (!email || !token) {
    throw new Error('Set REVOLUT_EMAIL and REVOLUT_TOKEN in performance-dashboard/.env')
  }
  return { email, token }
}

function rowToRecord(row) {
  const gradeId = String(row['Grade Record ID'] ?? '')
  const rankingRaw = row['Ranking Score']
  const ranking =
    rankingRaw === '' || rankingRaw == null ? null : Number(rankingRaw)

  return {
    id: gradeId || `row-${row['Employee ID']}-${row['Cycle ID']}`,
    sync_run_id: null,
    grade_record_id: gradeId || null,
    employee_id: row['Employee ID'] ? String(row['Employee ID']) : null,
    cycle_id: row['Cycle ID'] ? String(row['Cycle ID']) : null,
    employee_name: row.Employee ?? row['Employee'] ?? null,
    cycle_name: row['Cycle Name'] ?? null,
    department: row['Employee Department'] ?? null,
    team: row['Employee Team'] ?? null,
    display_grade: row['Display Grade'] ?? null,
    line_manager_grade: row['Line Manager Grade'] ?? null,
    calculated_grade: row['Calculated Grade'] ?? null,
    absolute_rating: row['Absolute Rating'] ?? null,
    ranking_score: Number.isFinite(ranking) ? ranking : null,
    payload: row,
    synced_at: new Date().toISOString(),
  }
}

export async function buildCacheFromRevolut() {
  const creds = getCredentials()
  const dataset = await loadRevolutPerformanceDataset(creds)
  const rows = flattenGrades(
    dataset.gradesResp,
    dataset.employeesList,
    dataset.cyclePayload,
    dataset.scorecardPayload,
  )

  const fetchedAt = new Date().toISOString()
  const records = rows.map(rowToRecord)

  return {
    fetchedAt,
    recordCount: records.length,
    records,
    employeesByEmail: buildEmployeesByEmailFromList(dataset.employeesList),
    cacheStatus: 'live',
  }
}

export async function saveCacheToDisk(data) {
  await writeDiskCache({
    fetchedAt: data.fetchedAt,
    recordCount: data.recordCount,
    records: data.records,
  })
}
