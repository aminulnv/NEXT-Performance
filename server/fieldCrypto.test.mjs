import crypto from 'crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encryptJson, decryptJson, parseEncryptionKey } from './fieldCrypto.mjs'

const TEST_KEY = Buffer.alloc(32, 7).toString('base64')

test('round-trips compressed JSON with AES-256-GCM', () => {
  const prev = process.env.PERFORMANCE_DATA_ENCRYPTION_KEY
  process.env.PERFORMANCE_DATA_ENCRYPTION_KEY = TEST_KEY
  try {
    const sample = { records: [{ id: '1', payload: { grade: 'A' } }], n: 42 }
    const envelope = encryptJson(sample)
    assert.equal(envelope.version, 2)
    const out = decryptJson(envelope)
    assert.deepEqual(out, sample)
  } finally {
    if (prev === undefined) delete process.env.PERFORMANCE_DATA_ENCRYPTION_KEY
    else process.env.PERFORMANCE_DATA_ENCRYPTION_KEY = prev
  }
})

test('decryptJson reads legacy uncompressed version 1 payloads', () => {
  const prev = process.env.PERFORMANCE_DATA_ENCRYPTION_KEY
  process.env.PERFORMANCE_DATA_ENCRYPTION_KEY = TEST_KEY
  try {
    const key = Buffer.from(TEST_KEY, 'base64')
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const plaintext = Buffer.from(JSON.stringify({ records: [{ id: 'legacy' }] }), 'utf8')
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()
    const blob = Buffer.concat([iv, tag, encrypted])
    const out = decryptJson({ version: 1, ciphertext: blob.toString('base64') })
    assert.deepEqual(out, { records: [{ id: 'legacy' }] })
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
