import type { PerformanceRecord } from '@/types/performance'
import { formatDuration, getScorecardTiming } from '@/lib/scorecard'

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key]
  if (v == null || v === '') return null
  return String(v).trim() || null
}

export type ScorecardSection = {
  title: string
  rating: string | null
  sectionGrade: string | null
  extra?: string | null
}

export type ScorecardCriterionGroup = {
  section: string
  criteria: { label: string; value: string }[]
}

export type AlternateScorecard = {
  id: string
  reviewer: string | null
  relation: string | null
  status: string | null
  openedAt: string | null
  completedAt: string | null
}

export type ScorecardDetail = {
  reviewer: string | null
  relation: string | null
  status: string | null
  overallRating: string | null
  reviewOverallRating: string | null
  openedAt: string | null
  completedAt: string | null
  duration: string | null
  sections: ScorecardSection[]
  barRaiser: { label: string; value: string | null }[]
  criteria: ScorecardCriterionGroup[]
  alternates: AlternateScorecard[]
}

const CRITERION_PREFIXES = [
  'Scorecard Deliverables',
  'Scorecard Values',
  'Scorecard Skills',
  'Scorecard Culture Skills',
] as const

export function extractCriteriaGroups(payload: Record<string, unknown>): ScorecardCriterionGroup[] {
  const groups: ScorecardCriterionGroup[] = []

  for (const prefix of CRITERION_PREFIXES) {
    const criteria: { label: string; value: string }[] = []
    for (const [key, raw] of Object.entries(payload)) {
      if (!key.startsWith(`${prefix} - `)) continue
      const value = raw == null || raw === '' ? '' : String(raw).trim()
      if (!value) continue
      criteria.push({ label: key.slice(prefix.length + 3), value })
    }
    if (criteria.length) {
      criteria.sort((a, b) => a.label.localeCompare(b.label))
      const section = prefix.replace('Scorecard ', '')
      groups.push({ section, criteria })
    }
  }

  return groups
}

export function parseAlternateScorecards(payload: Record<string, unknown>): AlternateScorecard[] {
  const raw = payload['All Scorecards (JSON)']
  if (!raw || typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => {
      const o = item as Record<string, unknown>
      return {
        id: String(o.id ?? ''),
        reviewer: o.reviewer != null ? String(o.reviewer) : null,
        relation: o.relation != null ? String(o.relation) : null,
        status: o.status != null ? String(o.status) : null,
        openedAt: o.opened != null ? String(o.opened) : null,
        completedAt: o.completed != null ? String(o.completed) : null,
      }
    })
  } catch {
    return []
  }
}

export function getScorecardDetail(record: PerformanceRecord): ScorecardDetail {
  const payload = record.payload ?? {}
  const timing = getScorecardTiming(record)

  const sections: ScorecardSection[] = [
    {
      title: 'Deliverables',
      rating: str(payload, 'Scorecard Deliverables Rating'),
      sectionGrade: str(payload, 'Scorecard Deliverables Section Grade'),
      extra: str(payload, 'Scorecard Deliverables Justifications'),
    },
    {
      title: 'Values',
      rating: str(payload, 'Scorecard Values Rating'),
      sectionGrade: str(payload, 'Scorecard Values Section Grade'),
    },
    {
      title: 'Skills',
      rating: str(payload, 'Scorecard Skills Rating'),
      sectionGrade: str(payload, 'Scorecard Skills Section Grade'),
      extra: str(payload, 'Scorecard Skills Rating Score'),
    },
  ]

  const barRaiser = [
    {
      label: 'Keep if competitive offer?',
      value: str(payload, 'Scorecard Bar Raiser - Keep if competitive offer?'),
    },
    {
      label: 'Re-hire in current role?',
      value: str(payload, 'Scorecard Bar Raiser - Re-hire in current role?'),
    },
    {
      label: 'RFP or promotion eligible?',
      value: str(payload, 'Scorecard Bar Raiser - RFP or promotion eligible?'),
    },
  ]

  return {
    reviewer: timing.reviewer,
    relation: str(payload, 'Scorecard Reviewer Relation'),
    status: timing.status,
    overallRating: str(payload, 'Scorecard Review Overall Rating'),
    reviewOverallRating: str(payload, 'Review Overall Rating'),
    openedAt: timing.openedAt ? timing.openedAt.toLocaleString() : null,
    completedAt: timing.completedAt ? timing.completedAt.toLocaleString() : null,
    duration: formatDuration(timing.durationMs),
    sections,
    barRaiser,
    criteria: extractCriteriaGroups(payload),
    alternates: parseAlternateScorecards(payload),
  }
}

export function hasScorecardData(record: PerformanceRecord): boolean {
  const { reviewer, status } = getScorecardTiming(record)
  const payload = record.payload ?? {}
  return Boolean(
    reviewer ||
      status ||
      payload['Scorecard Deliverables Rating'] ||
      payload['Review Overall Rating'],
  )
}
