import { describe, expect, it } from 'vitest'
import {
  currentCalendarQuarter,
  dayOfQuarter,
  isJoiningCutoffActiveForQuarter,
  parseQuarterYearFromCycle,
  previousCalendarQuarter,
  quarterHasStarted,
  quarterStartDate,
  resolveMonitoringQuarter,
  reviewCyclesMatch,
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
    expect(dayOfQuarter(2026, 3, new Date('2026-06-01'))).toBeNull()
  })

  it('detects whether a quarter has started', () => {
    expect(quarterHasStarted(2026, 2, new Date('2026-06-01'))).toBe(true)
    expect(quarterHasStarted(2026, 3, new Date('2026-06-01'))).toBe(false)
    expect(quarterHasStarted(2026, 3, new Date('2026-07-01'))).toBe(true)
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

  it('matches equivalent review cycle labels', () => {
    expect(reviewCyclesMatch('2026 H1', 'Q1 2026')).toBe(true)
    expect(reviewCyclesMatch('2026 H1', 'Q2 2026')).toBe(true)
    expect(reviewCyclesMatch('2026 H2', 'Q3 2026')).toBe(true)
    expect(reviewCyclesMatch('Q2 2026', 'Q2 2026 · Goals')).toBe(true)
    expect(reviewCyclesMatch('Q2 2026', 'Q2 Cycle')).toBe(true)
    expect(reviewCyclesMatch('LT 2025', 'LT 2025 Performance Eval')).toBe(true)
    expect(reviewCyclesMatch('2026 H1', 'Q3 2026')).toBe(false)
    expect(reviewCyclesMatch('Q1 2026', 'Q2 2026')).toBe(false)
    expect(reviewCyclesMatch('Q1 2026', 'Q2 Cycle')).toBe(false)
  })

  it('detects joining cutoff from Q2 2026 onward', () => {
    expect(isJoiningCutoffActiveForQuarter(2026, 1)).toBe(false)
    expect(isJoiningCutoffActiveForQuarter(2026, 2)).toBe(true)
    expect(isJoiningCutoffActiveForQuarter(2026, 3)).toBe(true)
    expect(isJoiningCutoffActiveForQuarter(2027, 1)).toBe(true)
  })

  it('resolves monitoring quarter from calendar filters or cycle label', () => {
    expect(resolveMonitoringQuarter('Q2 2026', 3, 2026)).toEqual({ quarter: 3, year: 2026 })
    expect(resolveMonitoringQuarter('Q2 2026', null, null)).toEqual({ quarter: 2, year: 2026 })
    expect(resolveMonitoringQuarter('LT 2025', null, null)).toBeNull()
  })
})
