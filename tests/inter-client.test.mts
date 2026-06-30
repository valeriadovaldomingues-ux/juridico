import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createPrivateKey } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildInterConfig,
  isInterProductionBaseUrl,
  isStagingDeployment,
  sanitizeInterError,
} from '../src/lib/interClient'

const TEST_CERT_DER_BASE64 = 'MIICqzCCAZOgAwIBAgIJAIOQhv7guRGnMA0GCSqGSIb3DQEBCwUAMBUxEzARBgNVBAMTClRFU1QgSU5URVIwHhcNMjYwNjI4MjAzNzI1WhcNMjYwNzI5MjAzNzI1WjAVMRMwEQYDVQQDEwpURVNUIElOVEVSMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1iJWa+ucpO8g+TTipva4p5tDqeDUj20SvrVgQIl6q/ChTfAEg4Wz8QJftg/Zzm+EsErhbEtng3kgY1YdkBUqjAdMvzVcIhX3RTcyK6Rwm4mc1/IuXfP3VP94/HfDl15hcVtRlHav/f2RKzXsXxKVQe+txztlb43cNbbxIwQbcjylCEIBHCXxpl+soq2Xr6iJsHIInNaO/pdaEOOjUkLd50ql//K/nevz4G5pJTA9TLeiaZVnIcwXXFHVml/hhx45YSKpiwpph8i0fAK8nIMAg3G6VV2OqhrBHlZqaXkaxqgOplNo81lG6jEvYYbyn1XeYypunIiVZwvK/jsuVn1s+QIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBks/KgonhvsIwj+dw4IyGv8IZVmv8QI0EBXcUHqZ/FESPvYyWN5DARGZjTESiF40OuAVkI2+eFUTkjshkoP2oktgigQk1zC9tLgwb4YHAndZmKKSDjcZx3ThxGfsf/fyKczZmunan/wUL/sMy5gfoDJRG06K2RqPiS+mvcPJQyK63SSYAemmpV2yRm/BXs7TWKqxxdCyzySCWm5FutGPbJ+juJg2xNtKGBDyRpaHFCGK531FvdUcX+7GNwOR1N4qoHyHmESmwAxID06WfFFPmPpZkpQdd60MCyRatKiptD47XQWFYjmFcv+pSk9iki4J3X0/RXAsaPKlM0/geMhKZS'

const TEST_RSA_JWK = {
  kty: 'RSA',
  n: '1iJWa-ucpO8g-TTipva4p5tDqeDUj20SvrVgQIl6q_ChTfAEg4Wz8QJftg_Zzm-EsErhbEtng3kgY1YdkBUqjAdMvzVcIhX3RTcyK6Rwm4mc1_IuXfP3VP94_HfDl15hcVtRlHav_f2RKzXsXxKVQe-txztlb43cNbbxIwQbcjylCEIBHCXxpl-soq2Xr6iJsHIInNaO_pdaEOOjUkLd50ql__K_nevz4G5pJTA9TLeiaZVnIcwXXFHVml_hhx45YSKpiwpph8i0fAK8nIMAg3G6VV2OqhrBHlZqaXkaxqgOplNo81lG6jEvYYbyn1XeYypunIiVZwvK_jsuVn1s-Q',
  e: 'AQAB',
  d: 'IgvLmdUYTtEGeRkDgHBx45Q4KeZpZXR-KnxEFX7GVlgoDXBAB3lWptctyJC0nLH2cuE0_jbu-mRj1ed3Q9VZsnHmrfAZ-gFsE0E3ZOD8Vn6GxX7oCGAlzwnffqS8IHENJSzTx7snOEb8sdYdAvC9coJdKvQyqI3xmUjBBkQ86OiZC5opkcxWX5ATpRX2anG8Bd7n-G6nCY7Pa-70SsZGbVXcIDGITu75QbK2VHGKZQSo36sQG7CQBTAQftqYiaDToLhFq8IDK7-pNqLFOBqge4H7yFwyDA26LIzDgOZI6HrHm5ogIyAclMAj2pEpD7GF-6Wmdclf5wnch0FDVMDWUQ',
  p: '764xpfcPlXO9Hl8elEfXf1eRYoHLDACAriEZcAi9PeefQmsZ93-fJqWuHO-Wb5pDiqbAWn0LxgPGcDEEkwS9cCJyjL4vCBvwuL6LXm9tSqsgZtbVHzIF-rZwmJwfVDLplRVdM5RUJ8Yu13tPmaTmTx8vk9N3uancjBzXjOBgW3s',
  q: '5LbaRv_94tVpk70VEb5K76ByPliY8F1eF3pLt9B8QnPrOvHFmzJEWHcXXdIm85FCtqjjy7dO6xlzkqS8UQ8SIyBS_VouQClwrN58e0rde-j2o1UP_g5xln29hseCODXmw7QZyiAFbHXBE1Y41K6z0V_Mz7HHgWqXnyj8YYjhJRs',
  dp: 'jKXR6Kx0bqU-Y2Y6EZWe9dEzNXUo6-AXoxc1UDMwqfUT1ev3ju9LO2iaJczKoK8L139G_VLH5-krN4bsQkHT0MvGIKUyADY1KpRWQJJuthR5rR-AbQ_zxk3tAQEMuWIvBBdHXA882yJHNpfb_DNyGxgX2U2MwlzVWTtLmhXJNaU',
  dq: 'TA0BR9qXcXXFRXr6JoxAHq4bTt_m-wYQ432m79hDeVVSQqdiLdjpIQF4o5ndmeATbul51aN-em5cH8bnV4zLWyLEdbom5u7gqJrSiay7ORid6nG-f5wN6RymiMqOYmKJ-UlJygwbwZTmPqfM_euZn2VblTRoQoBPKn1Wbpg1RUE',
  qi: 'ydSh9Y13kIuGalX4O96hPzlwmf_ir5GACYKKKCdt31p6zFTmcLu4UMW7mzTmmSQLSTDdUBVqHuSuX17n48pDcH4IXzTM7OE_aYuWwRdvNcP4Ye50HpMz0FphKlHqNAYJpjRueDIPYLqbI4QL1mh1fjve56iuJxCUwEN-J0h5iRM',
} as const

function wrapPem(label: string, base64Body: string) {
  const lines = base64Body.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

const TEST_CERT_PEM = wrapPem('CERTIFICATE', TEST_CERT_DER_BASE64)
const TEST_KEY_PEM = createPrivateKey({ key: TEST_RSA_JWK, format: 'jwk' }).export({ type: 'pkcs8', format: 'pem' }).toString()
const TEST_CERT_BASE64 = Buffer.from(TEST_CERT_PEM).toString('base64')
const TEST_KEY_BASE64 = Buffer.from(TEST_KEY_PEM).toString('base64')
const TEST_CA_BASE64 = TEST_CERT_BASE64

function baseEnv() {
  return {
    NODE_ENV: 'production',
    INTER_CLIENT_ID: 'client-id-test',
    INTER_CLIENT_SECRET: 'client-secret-test',
    INTER_WEBHOOK_SECRET: 'webhook-secret-test',
    INTER_BASE_URL: 'https://sandbox.inter.example',
    INTER_CERT_BASE64: TEST_CERT_BASE64,
    INTER_KEY_BASE64: TEST_KEY_BASE64,
    INTER_WEBHOOK_CA_BASE64: TEST_CA_BASE64,
  } as const
}

test('buildInterConfig loads base64 secrets and validates the pair in memory', () => {
  const config = buildInterConfig(baseEnv())

  assert.equal(config.clientId, 'client-id-test')
  assert.equal(config.clientSecret, 'client-secret-test')
  assert.equal(config.baseUrl, 'https://sandbox.inter.example/')
  assert.equal(config.cert.toString('utf8').includes('BEGIN CERTIFICATE'), true)
  assert.equal(config.key.toString('utf8').includes('BEGIN PRIVATE KEY'), true)
  assert.equal(config.ca.toString('utf8').includes('BEGIN CERTIFICATE'), true)
})

test('buildInterConfig rejects a missing certificate or key', () => {
  assert.throws(
    () => buildInterConfig({ ...baseEnv(), INTER_CERT_BASE64: '' }),
    /INTER_CERT_BASE64/i,
  )

  assert.throws(
    () => buildInterConfig({ ...baseEnv(), INTER_KEY_BASE64: '' }),
    /INTER_KEY_BASE64/i,
  )
})

test('buildInterConfig blocks the production Inter endpoint when staging is active', () => {
  assert.throws(
    () => buildInterConfig({
      ...baseEnv(),
      VERCEL_ENV: 'preview',
      INTER_BASE_URL: 'https://cdpj.partners.bancointer.com.br',
    }),
    /bloqueada em staging/i,
  )
})

test('buildInterConfig keeps local path compatibility in development only', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'pedv-inter-'))
  try {
    const certPath = join(tempDir, 'cert.pem')
    const keyPath = join(tempDir, 'key.pem')
    const caPath = join(tempDir, 'ca.pem')

    writeFileSync(certPath, TEST_CERT_PEM)
    writeFileSync(keyPath, TEST_KEY_PEM)
    writeFileSync(caPath, TEST_CERT_PEM)

    const config = buildInterConfig({
      NODE_ENV: 'development',
      INTER_CLIENT_ID: 'client-id-test',
      INTER_CLIENT_SECRET: 'client-secret-test',
      INTER_BASE_URL: 'https://sandbox.inter.example',
      INTER_CERT_PATH: certPath,
      INTER_KEY_PATH: keyPath,
      INTER_WEBHOOK_CA_PATH: caPath,
    })

    assert.equal(config.cert.toString('utf8').includes('BEGIN CERTIFICATE'), true)
    assert.equal(config.key.toString('utf8').includes('BEGIN PRIVATE KEY'), true)
    assert.equal(config.ca.toString('utf8').includes('BEGIN CERTIFICATE'), true)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('sanitizeInterError removes tokens and PEM blocks', () => {
  const sanitized = sanitizeInterError([
    'Bearer token-value',
    '{"access_token":"secret-token","client_secret":"super-secret"}',
    TEST_CERT_PEM,
  ].join('\n'))

  assert.equal(sanitized.includes('token-value'), false)
  assert.equal(sanitized.includes('secret-token'), false)
  assert.equal(sanitized.includes('super-secret'), false)
  assert.equal(sanitized.includes('BEGIN CERTIFICATE'), false)
})

test('isStagingDeployment and production-base-url detection work together', () => {
  assert.equal(isStagingDeployment({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), true)
  assert.equal(isStagingDeployment({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://staging.example.com' }), true)
  assert.equal(isInterProductionBaseUrl('https://cdpj.partners.bancointer.com.br'), true)
  assert.equal(isInterProductionBaseUrl('https://sandbox.example.com'), false)
})
