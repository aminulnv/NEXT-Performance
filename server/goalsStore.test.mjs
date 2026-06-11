import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { importGoalsFromCsv } from './goalsStore.mjs'

describe('importGoalsFromCsv', () => {
  it('rejects CSV that parses to zero goals without persisting', async () => {
    await assert.rejects(
      () => importGoalsFromCsv('Goal Name\n', { persist: false }),
      /zero goals/i,
    )
  })
})
