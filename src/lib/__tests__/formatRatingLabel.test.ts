import { describe, expect, it } from 'vitest'
import { displayRatingLabel, formatRatingLabel } from '@/lib/formatRatingLabel'

describe('formatRatingLabel', () => {
  it('formats plus suffix as +', () => {
    expect(formatRatingLabel('intermediate_plus')).toBe('Intermediate +')
    expect(formatRatingLabel('basic_plus')).toBe('Basic +')
    expect(formatRatingLabel('poor_plus')).toBe('Poor +')
  })

  it('formats minus suffix as -', () => {
    expect(formatRatingLabel('intermediate_minus')).toBe('Intermediate -')
    expect(formatRatingLabel('advanced_minus')).toBe('Advanced -')
  })

  it('formats multi-word snake_case', () => {
    expect(formatRatingLabel('improvement_needed')).toBe('Improvement Needed')
    expect(formatRatingLabel('yes_at_any_cost')).toBe('Yes At Any Cost')
  })

  it('leaves single words readable', () => {
    expect(formatRatingLabel('superpower')).toBe('Superpower')
    expect(formatRatingLabel('performing')).toBe('Performing')
    expect(formatRatingLabel('Exceeding')).toBe('Exceeding')
  })

  it('displayRatingLabel falls back to em dash', () => {
    expect(displayRatingLabel(null)).toBe('—')
    expect(displayRatingLabel('')).toBe('—')
    expect(displayRatingLabel('basic')).toBe('Basic')
  })
})
