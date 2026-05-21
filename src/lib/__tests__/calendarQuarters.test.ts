import { describe, expect, it } from 'vitest'
import {
  currentCalendarQuarter,
  dayOfQuarter,
  parseQuarterYearFromCycle,
  previousCalendarQuarter,
  quarterStartDate,
} from '@/lib/calendarQuarters'

describe('calendarQuarters', () => {
  it('returns quarter start dates', () => {
    expect(quarterStartDate(2026, 1)).toBe('2026-01-01')
    expect(quarterStartDate(2026, 2)).toBe('2026-04-01')
    expect(quarterStartDate(2026, 3)).toBe('2026-07-01')
    expect(quarterStartDate(2026, 4)).toBe('2026-10-01')
  })

  it('computes day of quarter', () => {
    expect(dayOfQuarter(2026, 2, new Date('2026-04-15'))).toBe(15)
    expect(dayOfQuarter(2026, 2, new Date('2026-05-20'))).toBe(50)
  })

  it('detects current calendar quarter', () => {
    expect(currentCalendarQuarter(new Date('2026-02-10'))).toBe(1)
    expect(currentCalendarQuarter(new Date('2026-08-01'))).toBe(3)
  })

  it('returns previous calendar quarter', () => {
    expect(previousCalendarQuarter(2, 2026)).toEqual({ quarter: 1, year: 2026 })
    expect(previousCalendarQuarter(1, 2026)).toEqual({ quarter: 4, year: 2025 })
  })

  it('parses review cycle labels', () => {
    expect(parseQuarterYearFromCycle('Q2 2026')).toEqual({ quarter: 2, year: 2026 })
    expect(parseQuarterYearFromCycle('LT 2025 Performance Eval')).toBeNull()
  })
})
