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
