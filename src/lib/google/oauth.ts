import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto'

export const GOOGLE_PROVIDER = 'google'
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const GMAIL_MODIFY_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'
export const GOOGLE_OAUTH_SCOPES = [GMAIL_READONLY_SCOPE, GMAIL_MODIFY_SCOPE] as const

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

export interface GoogleGmailProfile {
  emailAddress: string
  messagesTotal?: number
  threadsTotal?: number
}

interface StatePayload {
  userId: string
  nonce: string
  exp: number
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(input: string): Buffer {
  const padded = `${input}${'='.repeat((4 - input.length % 4) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function appBaseUrl(requestUrl?: string): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (requestUrl) {
    const url = new URL(requestUrl)
    return `${url.protocol}//${url.host}`
  }
  return 'http://localhost:3000'
}

export function googleRedirectUri(requestUrl?: string): string {
  return process.env.GOOGLE_REDIRECT_URI
    ?? `${appBaseUrl(requestUrl)}/api/integracoes/google/oauth/callback`
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} não configurada`)
  return value
}

function stateSecret(): string {
  return process.env.GOOGLE_OAUTH_STATE_SECRET
    ?? process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? requiredEnv('APP_ENCRYPTION_KEY')
}

function encryptionKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? process.env.APP_ENCRYPTION_KEY
  if (!raw) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY ou APP_ENCRYPTION_KEY não configurada')
  return createHash('sha256').update(raw).digest()
}

export function createOAuthState(userId: string, now = Date.now()): string {
  const payload: StatePayload = {
    userId,
    nonce: randomBytes(16).toString('hex'),
    exp: now + 10 * 60 * 1000,
  }
  const encodedPayload = base64Url(JSON.stringify(payload))
  const signature = base64Url(createHmac('sha256', stateSecret()).update(encodedPayload).digest())
  return `${encodedPayload}.${signature}`
}

export function validateOAuthState(state: string, expectedUserId: string, now = Date.now()): boolean {
  const [encodedPayload, signature] = state.split('.')
  if (!encodedPayload || !signature) return false

  const expectedSignature = base64Url(createHmac('sha256', stateSecret()).update(encodedPayload).digest())
  if (signature.length !== expectedSignature.length || signature !== expectedSignature) return false

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as StatePayload
    return payload.userId === expectedUserId && payload.exp >= now
  } catch {
    return false
  }
}

export function buildGoogleOAuthUrl(userId: string, requestUrl?: string): string {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', googleRedirectUri(requestUrl))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', createOAuthState(userId))
  return url.toString()
}

export async function exchangeGoogleCode(code: string, requestUrl?: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: googleRedirectUri(requestUrl),
      grant_type: 'authorization_code',
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Google OAuth token HTTP ${res.status}: ${body.error_description ?? body.error ?? res.statusText}`)
  }
  return body as GoogleTokenResponse
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Google OAuth refresh HTTP ${res.status}: ${body.error_description ?? body.error ?? res.statusText}`)
  }
  return body as GoogleTokenResponse
}

export async function fetchGmailProfile(accessToken: string): Promise<GoogleGmailProfile> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Gmail profile HTTP ${res.status}: ${body.error?.message ?? res.statusText}`)
  }
  return body as GoogleGmailProfile
}

export function encryptToken(plainText: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', base64Url(iv), base64Url(tag), base64Url(encrypted)].join(':')
}

export function decryptToken(payload: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(':')
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Token criptografado inválido')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), fromBase64Url(ivRaw))
  decipher.setAuthTag(fromBase64Url(tagRaw))
  return Buffer.concat([
    decipher.update(fromBase64Url(encryptedRaw)),
    decipher.final(),
  ]).toString('utf8')
}

export function tokenExpiresAt(expiresInSeconds?: number): string {
  const seconds = expiresInSeconds ?? 3600
  return new Date(Date.now() + seconds * 1000).toISOString()
}
