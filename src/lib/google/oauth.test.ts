import { afterEach, describe, expect, it, vi } from 'vitest'

describe('google oauth helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('gera e valida state assinado para o mesmo usuário', async () => {
    vi.stubEnv('GOOGLE_OAUTH_STATE_SECRET', 'state-secret')
    vi.stubEnv('APP_ENCRYPTION_KEY', 'encryption-secret')
    const { createOAuthState, validateOAuthState } = await import('./oauth')

    const state = createOAuthState('uid-socio', 1_000)

    expect(validateOAuthState(state, 'uid-socio', 2_000)).toBe(true)
    expect(validateOAuthState(state, 'outro-user', 2_000)).toBe(false)
    expect(validateOAuthState(state, 'uid-socio', 11 * 60 * 1000 + 2_000)).toBe(false)
  })

  it('criptografa e descriptografa token sem preservar texto puro', async () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', 'encryption-secret')
    const { encryptToken, decryptToken } = await import('./oauth')

    const encrypted = encryptToken('refresh-token-sensivel')

    expect(encrypted).not.toContain('refresh-token-sensivel')
    expect(decryptToken(encrypted)).toBe('refresh-token-sensivel')
  })

  it('monta URL OAuth com gmail.readonly e access_type offline', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_OAUTH_STATE_SECRET', 'state-secret')
    vi.stubEnv('APP_ENCRYPTION_KEY', 'encryption-secret')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://sistema.test')
    const { buildGoogleOAuthUrl, GMAIL_READONLY_SCOPE } = await import('./oauth')

    const url = new URL(buildGoogleOAuthUrl('uid-socio'))

    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('client_id')).toBe('client-id.apps.googleusercontent.com')
    expect(url.searchParams.get('scope')).toBe(GMAIL_READONLY_SCOPE)
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('redirect_uri')).toBe('https://sistema.test/api/integracoes/google/oauth/callback')
  })
})
