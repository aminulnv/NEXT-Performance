import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encryptJson, decryptJson, parseEncryptionKey } from './fieldCrypto.mjs'

const TEST_KEY = Buffer.alloc(32, 7).toString('base64')

test('round-trips JSON with AES-256-GCM', () => {
  const prev = process.env.PERFORMANCE_DATA_ENCRYPTION_KEY
  process.env.PERFORMANCE_DATA_ENCRYPTION_KEY = TEST_KEY
  try {
    const sample = { records: [{ id: '1', payload: { grade: 'A' } }], n: 42 }
    const envelope = encryptJson(sample)
    const out = decryptJson(envelope)
    assert.deepEqual(out, sample)
  } finally {
    if (prev === undefined) delete process.env.PERFORMANCE_DATA_ENCRYPTION_KEY
    else process.env.PERFORMANCE_DATA_ENCRYPTION_KEY = prev
  }
})

test('parseEncryptionKey accepts base64 and hex', () => {
  assert.equal(parseEncryptionKey(TEST_KEY)?.length, 32)
  assert.equal(parseEncryptionKey(Buffer.alloc(32, 1).toString('hex'))?.length, 32)
  assert.equal(parseEncryptionKey('too-short'), null)
})
