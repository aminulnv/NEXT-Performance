import type { PerformanceRecord } from '@/types/performance'
import { buildDashboardSummary } from '@/lib/metrics'

export type CycleSummary = {
  cycleName: string
  recordCount: number
  employeeCount: number
  timelineStatusCounts: { status: string; count: number }[]
  outcomeCounts: { outcome: string; count: number }[]
  withCompletedTimeline: number
}

function payloadStr(payload: Record<string, unknown>, key: string): string {
  const v = payload[key]
  if (v == null || v === '') return ''
  return String(v).trim()
}

export function buildCycleSummaries(records: PerformanceRecord[]): CycleSummary[] {
  const byCycle = new Map<string, PerformanceRecord[]>()
  for (const r of records) {
    const name = r.cycle_name || 'Unknown'
    const list = byCycle.get(name) ?? []
    list.push(r)
    byCycle.set(name, list)
  }

  return [...byCycle.entries()]
    .map(([cycleName, cycleRecords]) => {
      const summary = buildDashboardSummary(cycleRecords)
      const statusMap = new Map<string, number>()
      const outcomeMap = new Map<string, number>()
      let withCompletedTimeline = 0

      for (const r of cycleRecords) {
        const p = r.payload ?? {}
        const status = payloadStr(p, 'Cycle Timeline Status') || 'Unknown'
        statusMap.set(status, (statusMap.get(status) ?? 0) + 1)
        const outcome = payloadStr(p, 'Employee Cycle Outcome') || 'Unknown'
        outcomeMap.set(outcome, (outcomeMap.get(outcome) ?? 0) + 1)
        if (payloadStr(p, 'Cycle Completion Date') || status.toLowerCase().includes('complete')) {
          withCompletedTimeline++
        }
      }

      return {
        cycleName,
        recordCount: summary.totalRecords,
        employeeCount: summary.totalEmployees,
        timelineStatusCounts: [...statusMap.entries()]
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
        outcomeCounts: [...outcomeMap.entries()]
          .map(([outcome, count]) => ({ outcome, count }))
          .sort((a, b) => b.count - a.count),
        withCompletedTimeline,
      }
    })
    .sort((a, b) => b.recordCount - a.recordCount)
}
