import { revolutLogin, revolutRequest, sleep } from './revolutHttp.mjs'

const PAGE_SIZE = 100
const INCLUDE_SCORECARDS = process.env.INCLUDE_SCORECARDS !== 'false'

async function fetchAllPages(token, path, query = {}, maxPages = 50) {
  const all = []
  let page = 1
  let totalCount = null

  while (page <= maxPages) {
    const resp = await revolutRequest(token, path, { page, page_size: PAGE_SIZE, ...query })
    if (totalCount == null && resp.count != null) totalCount = resp.count
    const batch = Array.isArray(resp.results) ? resp.results : []
    all.push(...batch)
    if (batch.length === 0) break
    if (batch.length < PAGE_SIZE) break
    if (totalCount != null && all.length >= totalCount) break
    page += 1
  }

  return all
}

function normalizeCycleName(name) {
  if (typeof name !== 'string') return ''
  return name.split('·')[0].trim().toLowerCase()
}

function ingestCycles(cycleMap, cycleNameToId, results) {
  if (!Array.isArray(results)) return
  for (const item of results) {
    let cycleId = null
    let cycleName = ''
    const nested = item.cycle
    if (nested?.id != null) {
      cycleId = nested.id
      cycleName = typeof nested.name === 'string' ? nested.name.trim() : ''
    } else if (item.type === 'cycle' && item.id != null) {
      cycleId = item.id
      cycleName = typeof item.stage === 'string' ? item.stage.trim() : ''
    }
    if (cycleId == null || !cycleName) continue
    cycleMap[cycleId] = cycleName
    cycleMap[String(cycleId)] = cycleName
    cycleNameToId[normalizeCycleName(cycleName)] = cycleId
  }
}

function ingestTimeline(timelineByEmpCycle, cycleNameToId, cycleMap, results) {
  if (!Array.isArray(results)) return
  for (const item of results) {
    if (item.type !== 'cycle' || item.reviewed_employee_id == null) continue
    const stage = typeof item.stage === 'string' ? item.stage.trim() : ''
    const stageKey = normalizeCycleName(stage)
    let cycleId = cycleNameToId[stageKey]
    if (cycleId == null) {
      for (const [id, name] of Object.entries(cycleMap)) {
        if (String(Number(id)) !== String(id)) continue
        const base = normalizeCycleName(name)
        if (stageKey === base || stageKey.startsWith(base) || base.startsWith(stageKey)) {
          cycleId = Number(id)
          break
        }
      }
    }
    if (cycleId == null) continue
    const key = `${item.reviewed_employee_id}:${cycleId}`
    const ec = item.employee_cycle || {}
    const cy = item.cycle || {}
    timelineByEmpCycle[key] = {
      completion_date_time: item.completion_date_time ?? '',
      status: item.status ?? '',
      stage,
      timeline_item_id: item.id,
      category: item.category ?? '',
      type: item.type ?? '',
      reviewer_relation: item.reviewer_relation ?? '',
      employee_seniority_id: item.employee_seniority_id ?? '',
      employee_specialisation_id: item.employee_specialisation_id ?? '',
      employee_specialisation_seniority_sublevel_id:
        item.employee_specialisation_seniority_sublevel_id ?? '',
      cycle_nested_id: cy.id ?? '',
      cycle_nested_name: typeof cy.name === 'string' ? cy.name.trim() : '',
      employee_cycle_id: ec.id ?? '',
      employee_cycle_hr_manager_id: ec.hr_manager_id ?? '',
      employee_cycle_name: typeof ec.name === 'string' ? ec.name.trim() : '',
      employee_cycle_start: ec.start_date_time ?? '',
      employee_cycle_end: ec.end_date_time ?? '',
      employee_cycle_rating_score: ec.rating_score ?? '',
      employee_cycle_rating_label: ec.rating_label ?? '',
      employee_cycle_grade: ec.grade ?? '',
      employee_cycle_skills_rating: ec.skills_rating ?? '',
      employee_cycle_values_rating: ec.values_rating ?? '',
      employee_cycle_deliverables_rating: ec.deliverables_rating ?? '',
      employee_cycle_outcome: ec.outcome ?? '',
    }
  }
}

async function fetchCyclePayload(token) {
  const cycleMap = {}
  const cycleNameToId = {}
  const timelineByEmpCycle = {}
  const timelineItems = await fetchAllPages(
    token,
    '/performance/timelineItems',
    { category: 'performance' },
    50,
  )
  ingestCycles(cycleMap, cycleNameToId, timelineItems)
  ingestTimeline(timelineByEmpCycle, cycleNameToId, cycleMap, timelineItems)
  return { cycleMap, timelineByEmpCycle }
}

async function fetchScorecardPayload(token) {
  const all = await fetchAllPages(token, '/performance/performanceScorecards', {}, 50)
  const scorecardBuckets = {}
  for (const s of all) {
    if (s.reviewed_employee_id == null) continue
    const cycleKey = `${s.reviewed_employee_id}:${s.cycle_id}`
    if (!scorecardBuckets[cycleKey]) scorecardBuckets[cycleKey] = []
    scorecardBuckets[cycleKey].push(s)
    if (s.eligibility_id != null) {
      const eligKey = `${s.reviewed_employee_id}:elig:${s.eligibility_id}`
      if (!scorecardBuckets[eligKey]) scorecardBuckets[eligKey] = []
      scorecardBuckets[eligKey].push(s)
    }
  }
  return { scorecardBuckets, scorecard_count: all.length }
}

/** Sequential fetches to avoid Revolut 429 rate limits. */
export async function loadRevolutPerformanceDataset({ email, token: apiToken }) {
  const sessionToken = await revolutLogin(email, apiToken)

  const employeesResp = await revolutRequest(sessionToken, '/employees', {
    page: 1,
    page_size: 1000,
  })
  await sleep(500)

  const gradesResults = await fetchAllPages(sessionToken, '/performance/finalGrades', {}, 20)
  await sleep(500)

  const cyclePayload = await fetchCyclePayload(sessionToken)
  await sleep(500)

  let scorecardPayload = { scorecardBuckets: {}, scorecard_count: 0 }
  if (INCLUDE_SCORECARDS) {
    scorecardPayload = await fetchScorecardPayload(sessionToken)
  }

  const employeesList = employeesResp.results ?? employeesResp.data ?? []
  const gradesResp = { results: gradesResults, count: gradesResults.length }

  return {
    gradesResp,
    employeesList,
    cyclePayload,
    scorecardPayload,
  }
}
