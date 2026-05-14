import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isAllowedOrigin, checkOrigin } from './origin'

// ── isAllowedOrigin ────────────────────────────────────────────────────────────

describe('isAllowedOrigin', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.pedv.com.br')
    vi.stubEnv('VERCEL_URL', undefined as unknown as string)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // Localhost dev
  it('permite http://localhost:3000', () => {
    expect(isAllowedOrigin(req('http://localhost:3000'))).toBe(true)
  })

  it('permite http://localhost em qualquer porta', () => {
    expect(isAllowedOrigin(req('http://localhost:8080'))).toBe(true)
  })

  it('permite http://127.0.0.1:3000', () => {
    expect(isAllowedOrigin(req('http://127.0.0.1:3000'))).toBe(true)
  })

  // Domínio configurado
  it('permite o domínio configurado em NEXT_PUBLIC_APP_URL', () => {
    expect(isAllowedOrigin(req('https://app.pedv.com.br'))).toBe(true)
  })

  it('bloqueia subdomínio não configurado', () => {
    expect(isAllowedOrigin(req('https://evil.pedv.com.br'))).toBe(false)
  })

  it('bloqueia domínio completamente diferente', () => {
    expect(isAllowedOrigin(req('https://attacker.com'))).toBe(false)
  })

  it('bloqueia origin null explícito como string', () => {
    expect(isAllowedOrigin(req('null'))).toBe(false)
  })

  // Sem origin header
  it('permite request sem Origin header (allowMissingOrigin default: true)', () => {
    expect(isAllowedOrigin(reqNoOrigin())).toBe(true)
  })

  it('bloqueia request sem Origin header quando allowMissingOrigin: false', () => {
    expect(isAllowedOrigin(reqNoOrigin(), { allowMissingOrigin: false })).toBe(false)
  })

  // Vercel previews
  it('permite *.vercel.app quando VERCEL_URL está configurado', () => {
    vi.stubEnv('VERCEL_URL', 'my-app.vercel.app')
    expect(isAllowedOrigin(req('https://my-preview.vercel.app'))).toBe(true)
  })

  it('bloqueia *.vercel.app quando VERCEL_URL não está configurado', () => {
    // VERCEL_URL não configurado (beforeEach já setou como undefined)
    expect(isAllowedOrigin(req('https://evil.vercel.app'))).toBe(false)
  })
})

// ── checkOrigin ────────────────────────────────────────────────────────────────

describe('checkOrigin', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.pedv.com.br')
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('retorna null (permitido) para localhost', () => {
    expect(checkOrigin(req('http://localhost:3000'))).toBeNull()
  })

  it('retorna null (permitido) para domínio configurado', () => {
    expect(checkOrigin(req('https://app.pedv.com.br'))).toBeNull()
  })

  it('retorna Response 403 para origin externo', () => {
    const response = checkOrigin(req('https://attacker.com'))
    expect(response).not.toBeNull()
    expect(response!.status).toBe(403)
  })

  it('body da resposta 403 é JSON válido com campo error', async () => {
    const response = checkOrigin(req('https://attacker.com'))!
    const body = await response.json()
    expect(body).toHaveProperty('error')
    expect(typeof body.error).toBe('string')
  })

  it('retorna null (permitido) para request sem Origin', () => {
    expect(checkOrigin(reqNoOrigin())).toBeNull()
  })
})

// ── CSRF attack simulation ────────────────────────────────────────────────────

describe('CSRF — simulação de ataque cross-site', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.pedv.com.br')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('bloqueia form submission de site externo (CSRF básico)', () => {
    const result = checkOrigin(req('https://evil.com'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('bloqueia request de subdomínio não autorizado', () => {
    const result = checkOrigin(req('https://sub.attacker.com'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('bloqueia origin com port diferente do configurado', () => {
    // NEXT_PUBLIC_APP_URL = https://app.pedv.com.br (sem porta)
    // origin com porta explícita 443 não deve ser automaticamente permitido
    // Nota: https://app.pedv.com.br e https://app.pedv.com.br:443 são equivalentes
    // mas a comparação de string difere — conservador é correto
    const result = checkOrigin(req('https://app.pedv.com.br:8080'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function req(origin: string): Request {
  return new Request('http://localhost/api/test', {
    method:  'POST',
    headers: { 'origin': origin, 'content-type': 'application/json' },
  })
}

function reqNoOrigin(): Request {
  return new Request('http://localhost/api/test', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
  })
}
