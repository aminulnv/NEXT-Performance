import { describe, expect, it } from 'vitest'
import {
  extractCriteriaGroups,
  getScorecardDetail,
  parseAlternateScorecards,
} from '@/lib/scorecardPayload'
import { sampleRecords } from './fixtures'

describe('extractCriteriaGroups', () => {
  it('groups criterion columns by section prefix', () => {
    const groups = extractCriteriaGroups(sampleRecords[0].payload)
    expect(groups.some((g) => g.section === 'Deliverables')).toBe(true)
    const deliverables = groups.find((g) => g.section === 'Deliverables')
    expect(deliverables?.criteria.some((c) => c.label === 'Speed')).toBe(true)
  })
})

describe('parseAlternateScorecards', () => {
  it('parses All Scorecards JSON array', () => {
    const alts = parseAlternateScorecards(sampleRecords[0].payload)
    expect(alts).toHaveLength(2)
    expect(alts[0].reviewer).toBe('Bob')
  })
})

describe('getScorecardDetail', () => {
  it('includes criteria and alternates on detail', () => {
    const detail = getScorecardDetail(sampleRecords[0])
    expect(detail.criteria.length).toBeGreaterThan(0)
    expect(detail.alternates).toHaveLength(2)
  })
})
