import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

export function isEncryptionKeyConfigured() {
  return Boolean(parseEncryptionKey(process.env.PERFORMANCE_DATA_ENCRYPTION_KEY))
}

export function parseEncryptionKey(raw) {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    const key = Buffer.from(trimmed, 'hex')
    return key.length === KEY_LENGTH ? key : null
  }

  try {
    const key = Buffer.from(trimmed, 'base64')
    return key.length === KEY_LENGTH ? key : null
  } catch {
    return null
  }
}

function requireKey() {
  const key = parseEncryptionKey(process.env.PERFORMANCE_DATA_ENCRYPTION_KEY)
  if (!key) {
    throw new Error(
      'Set PERFORMANCE_DATA_ENCRYPTION_KEY (32 bytes: openssl rand -base64 32) to use encrypted Supabase cache',
    )
  }
  return key
}

/** @param {unknown} value */
export function encryptJson(value) {
  const key = requireKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const plaintext = JSON.stringify(value)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const blob = Buffer.concat([iv, tag, encrypted])
  return { version: 1, ciphertext: blob.toString('base64') }
}

/**
 * @param {{ version: number, ciphertext: string }} envelope
 */
export function decryptJson(envelope) {
  const key = requireKey()
  const raw = Buffer.from(envelope.ciphertext, 'base64')
  if (raw.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = raw.subarray(0, IV_LENGTH)
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const data = raw.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return JSON.parse(plaintext)
}
