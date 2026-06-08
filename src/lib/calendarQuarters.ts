export type CalendarQuarter = 1 | 2 | 3 | 4

export type CalendarQuarterOption = {
  quarter: CalendarQuarter
  label: string
  startMonth: number
}

/** Calendar quarters (Jan–Mar, Apr–Jun, etc.). */
export const CALENDAR_QUARTERS: CalendarQuarterOption[] = [
  { quarter: 1, label: 'Q1 (Jan - Mar)', startMonth: 0 },
  { quarter: 2, label: 'Q2 (Apr - June)', startMonth: 3 },
  { quarter: 3, label: 'Q3 (Jul - Sept)', startMonth: 6 },
  { quarter: 4, label: 'Q4 (Oct - Dec)', startMonth: 9 },
]

export function currentCalendarYear(referenceDate = new Date()): number {
  return referenceDate.getFullYear()
}

export function currentCalendarQuarter(referenceDate = new Date()): CalendarQuarter {
  const month = referenceDate.getMonth()
  if (month < 3) return 1
  if (month < 6) return 2
  if (month < 9) return 3
  return 4
}

/** ISO date string (YYYY-MM-DD) for the first day of the quarter. */
export function quarterStartDate(
  year: number,
  quarter: CalendarQuarter,
): string {
  const option = CALENDAR_QUARTERS.find((q) => q.quarter === quarter)
  if (!option) throw new Error(`Invalid quarter: ${quarter}`)
  const month = String(option.startMonth + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/** Day number within the quarter (1 = first day). */
export function dayOfQuarter(
  year: number,
  quarter: CalendarQuarter,
  referenceDate = new Date(),
): number | null {
  const start = new Date(quarterStartDate(year, quarter))
  if (Number.isNaN(start.getTime())) return null
  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  const diff = Math.floor((ref.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  if (diff < 0) return null
  return diff + 1
}

export function quarterLabel(quarter: CalendarQuarter | null): string {
  if (quarter == null) return 'All quarters'
  return CALENDAR_QUARTERS.find((q) => q.quarter === quarter)?.label ?? `Q${quarter}`
}

/** Calendar quarter immediately before the given one (Q2 2026 → Q1 2026). */
export function previousCalendarQuarter(
  quarter: CalendarQuarter,
  year: number,
): { quarter: CalendarQuarter; year: number } {
  if (quarter === 1) return { quarter: 4, year: year - 1 }
  return { quarter: (quarter - 1) as CalendarQuarter, year }
}

export function formatQuarterYear(quarter: CalendarQuarter, year: number): string {
  return `Q${quarter} ${year}`
}

/** First calendar quarter where joining-date cutoff applies (inclusive). */
export const JOINING_DATE_CUTOFF_FROM = { year: 2026, quarter: 2 as CalendarQuarter }

/** True from Q2 2026 onward — earlier quarters keep the full active roster. */
export function isJoiningCutoffActiveForQuarter(
  year: number,
  quarter: CalendarQuarter,
): boolean {
  if (year > JOINING_DATE_CUTOFF_FROM.year) return true
  if (year === JOINING_DATE_CUTOFF_FROM.year) {
    return quarter >= JOINING_DATE_CUTOFF_FROM.quarter
  }
  return false
}

/** Resolve monitoring quarter from calendar filters or a goals cycle label like "Q2 2026". */
export function resolveMonitoringQuarter(
  cycleFilter: string | null | undefined,
  calendarQuarter: CalendarQuarter | null | undefined,
  calendarYear: number | null | undefined,
): { quarter: CalendarQuarter; year: number } | null {
  if (calendarQuarter != null && calendarYear != null) {
    return { quarter: calendarQuarter, year: calendarYear }
  }
  return parseQuarterYearFromCycle(cycleFilter)
}

/** True once the calendar quarter has begun (local date). */
export function quarterHasStarted(
  year: number,
  quarter: CalendarQuarter,
  referenceDate = new Date(),
): boolean {
  return dayOfQuarter(year, quarter, referenceDate) != null
}

/** Parses labels like "Q2 2026" from Revolut review cycle. */
export function parseQuarterYearFromCycle(
  cycle: string | null | undefined,
): { quarter: CalendarQuarter; year: number } | null {
  const text = cycle?.trim()
  if (!text) return null
  const match = text.match(/\bQ\s*([1-4])\s+(\d{4})\b/i)
  if (!match) return null
  return {
    quarter: Number(match[1]) as CalendarQuarter,
    year: Number(match[2]),
  }
}

/** Parses quarter from labels like "Q2 Cycle" that omit the year. */
export function parseQuarterOnlyFromCycle(
  cycle: string | null | undefined,
): CalendarQuarter | null {
  const text = cycle?.trim()
  if (!text) return null
  if (/\b\d{4}\b/.test(text)) return null
  const match = text.match(/\bQ\s*([1-4])\b/i)
  if (!match) return null
  return Number(match[1]) as CalendarQuarter
}

/** Revolut cycle labels often include a stage suffix after a middle dot. */
export function normalizeReviewCycleLabel(cycle: string | null | undefined): string {
  if (!cycle) return ''
  return cycle.split('·')[0].trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseHalfYearFromCycle(
  cycle: string | null | undefined,
): { half: 1 | 2; year: number } | null {
  const text = cycle?.trim()
  if (!text) return null
  const match = text.match(/\b(\d{4})\s*H\s*([12])\b/i)
  if (!match) return null
  return { year: Number(match[1]), half: Number(match[2]) as 1 | 2 }
}

function halfYearMatchesQuarter(
  halfYear: { half: 1 | 2; year: number },
  quarter: CalendarQuarter,
  year: number,
): boolean {
  if (halfYear.year !== year) return false
  if (halfYear.half === 1) return quarter === 1 || quarter === 2
  return quarter === 3 || quarter === 4
}

/** True when a goals cycle label and a performance review cycle refer to the same cycle. */
export function reviewCyclesMatch(
  filter: string | null | undefined,
  cycle: string | null | undefined,
): boolean {
  if (!filter) return true
  if (!cycle) return false

  const left = filter.trim()
  const right = cycle.trim()
  if (!left || !right) return false

  const normLeft = normalizeReviewCycleLabel(left)
  const normRight = normalizeReviewCycleLabel(right)
  if (normLeft === normRight) return true
  if (normLeft.startsWith(normRight) || normRight.startsWith(normLeft)) return true

  const filterQuarter = parseQuarterYearFromCycle(left)
  const cycleQuarter = parseQuarterYearFromCycle(right)
  if (filterQuarter && cycleQuarter) {
    return (
      filterQuarter.quarter === cycleQuarter.quarter && filterQuarter.year === cycleQuarter.year
    )
  }

  const filterHalf = parseHalfYearFromCycle(left)
  const cycleHalf = parseHalfYearFromCycle(right)
  if (filterHalf && cycleQuarter) {
    return halfYearMatchesQuarter(filterHalf, cycleQuarter.quarter, cycleQuarter.year)
  }
  if (cycleHalf && filterQuarter) {
    return halfYearMatchesQuarter(cycleHalf, filterQuarter.quarter, filterQuarter.year)
  }
  if (filterHalf && cycleHalf) {
    return filterHalf.half === cycleHalf.half && filterHalf.year === cycleHalf.year
  }

  const filterQuarterOnly = parseQuarterOnlyFromCycle(left)
  const cycleQuarterOnly = parseQuarterOnlyFromCycle(right)

  // Goals CSV often uses quarter-only labels like "Q2 Cycle" while performance uses "Q2 2026".
  if (filterQuarter && cycleQuarterOnly) {
    return filterQuarter.quarter === cycleQuarterOnly
  }
  if (cycleQuarter && filterQuarterOnly) {
    return cycleQuarter.quarter === filterQuarterOnly
  }
  if (filterQuarterOnly && cycleQuarterOnly) {
    return filterQuarterOnly === cycleQuarterOnly
  }

  return false
}
