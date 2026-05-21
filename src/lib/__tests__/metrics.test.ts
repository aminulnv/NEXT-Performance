import { describe, expect, it } from 'vitest'
import {
  buildCalibrationRows,
  buildDepartmentSummaries,
  dedupeEmployees,
  getRecordsForEmployee,
} from '@/lib/metrics'
import { buildCycleSummaries } from '@/lib/cycles'
import { sampleRecords } from './fixtures'

describe('dedupeEmployees', () => {
  it('returns one row per employee with latest cycle', () => {
    const people = dedupeEmployees(sampleRecords)
    expect(people).toHaveLength(2)
    const alice = people.find((p) => p.employeeId === 'emp-a')
    expect(alice?.cyclesCount).toBe(2)
    expect(alice?.latestCycle).toBe('2025 H1')
    expect(alice?.lineManagerName).toBe('Bob Manager')
  })
})

describe('getRecordsForEmployee', () => {
  it('returns all cycles for an employee sorted by cycle name desc', () => {
    const rows = getRecordsForEmployee(sampleRecords, 'emp-a')
    expect(rows).toHaveLength(2)
    expect(rows[0].cycle_name).toBe('2025 H1')
  })
})

describe('buildDepartmentSummaries', () => {
  it('counts distinct cycles per department', () => {
    const departments = buildDepartmentSummaries(sampleRecords)
    const engineering = departments.find((d) => d.department === 'Engineering')
    const product = departments.find((d) => d.department === 'Product')
    expect(engineering?.cyclesCount).toBe(2)
    expect(product?.cyclesCount).toBe(1)
  })

  it('returns one cycle when filtered by cycle', () => {
    const departments = buildDepartmentSummaries(sampleRecords, '2024 H2')
    expect(departments.every((d) => d.cyclesCount === 1)).toBe(true)
  })
})

describe('buildCalibrationRows', () => {
  it('maps calibrator fields from payload', () => {
    const rows = buildCalibrationRows(sampleRecords)
    const alice = rows.find((r) => r.recordId === 'grade-1')
    expect(alice?.departmentCalibrator).toBe('Cal A')
    expect(alice?.gradeCalibrated).toBe('true')
  })
})

describe('buildCycleSummaries', () => {
  it('aggregates records by cycle name', () => {
    const cycles = buildCycleSummaries(sampleRecords)
    expect(cycles.length).toBeGreaterThanOrEqual(2)
    const h2 = cycles.find((c) => c.cycleName === '2024 H2')
    expect(h2?.recordCount).toBe(2)
    expect(h2?.employeeCount).toBe(2)
  })
})
