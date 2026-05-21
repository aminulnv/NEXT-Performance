import type { PerformanceRecord } from '@/types/performance'

const OPENED_KEY = 'Scorecard Opened Date Time'
const COMPLETED_KEY = 'Scorecard Completed Date Time'
const REVIEWER_KEY = 'Scorecard Reviewer'
const STATUS_KEY = 'Scorecard Status'

export type ScorecardTiming = {
  openedAt: Date | null
  completedAt: Date | null
  durationMs: number | null
  reviewer: string | null
  status: string | null
}

function parsePayloadDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

export function getScorecardTiming(record: PerformanceRecord): ScorecardTiming {
  const payload = record.payload ?? {}
  const openedAt = parsePayloadDate(payload[OPENED_KEY])
  const completedAt = parsePayloadDate(payload[COMPLETED_KEY])
  let durationMs: number | null = null
  if (openedAt && completedAt) {
    const delta = completedAt.getTime() - openedAt.getTime()
    durationMs = delta >= 0 ? delta : null
  }
  const reviewerRaw = payload[REVIEWER_KEY]
  const statusRaw = payload[STATUS_KEY]
  return {
    openedAt,
    completedAt,
    durationMs,
    reviewer: reviewerRaw != null && String(reviewerRaw).trim() ? String(reviewerRaw) : null,
    status: statusRaw != null && String(statusRaw).trim() ? String(statusRaw) : null,
  }
}

export function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec} sec`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  const hr = Math.floor(min / 60)
  const remMin = min % 60
  if (hr < 24) return remMin > 0 ? `${hr} hr ${remMin} min` : `${hr} hr`
  const days = Math.floor(hr / 24)
  const remHr = hr % 24
  return remHr > 0 ? `${days} d ${remHr} hr` : `${days} d`
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export type ReviewerTimingRow = {
  reviewer: string
  reviewCount: number
  avgDurationMs: number
  medianDurationMs: number
}

export type ReviewTimingSummary = {
  withTiming: number
  withoutTiming: number
  avgDurationMs: number | null
  medianDurationMs: number | null
  byReviewer: ReviewerTimingRow[]
}

export function buildReviewTimingSummary(records: PerformanceRecord[]): ReviewTimingSummary {
  const durations: number[] = []
  const byReviewer = new Map<string, number[]>()

  for (const record of records) {
    const { durationMs, reviewer } = getScorecardTiming(record)
    if (durationMs == null) continue
    durations.push(durationMs)
    const key = reviewer || 'Unknown reviewer'
    const list = byReviewer.get(key) ?? []
    list.push(durationMs)
    byReviewer.set(key, list)
  }

  const avgDurationMs =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null

  const reviewerRows: ReviewerTimingRow[] = [...byReviewer.entries()]
    .map(([name, values]) => ({
      reviewer: name,
      reviewCount: values.length,
      avgDurationMs: values.reduce((a, b) => a + b, 0) / values.length,
      medianDurationMs: median(values) ?? 0,
    }))
    .sort((a, b) => b.reviewCount - a.reviewCount)

  return {
    withTiming: durations.length,
    withoutTiming: records.length - durations.length,
    avgDurationMs,
    medianDurationMs: median(durations),
    byReviewer: reviewerRows,
  }
}

export function formatScorecardDateTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
