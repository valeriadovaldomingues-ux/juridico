import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logSecurity } from './logger'

describe('logSecurity', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('emite JSON estruturado via console.warn', () => {
    logSecurity({
      type:     'rate_limit',
      endpoint: 'POST /api/portal/mensagens',
      ip:       '1.2.3.4',
      userId:   'uid-123',
      detail:   'by_user',
    })

    expect(console.warn).toHaveBeenCalledTimes(1)
    const raw = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const parsed = JSON.parse(raw)

    expect(parsed.source).toBe('portal:security')
    expect(parsed.type).toBe('rate_limit')
    expect(parsed.endpoint).toBe('POST /api/portal/mensagens')
    expect(parsed.ip).toBe('1.2.3.4')
    expect(parsed.userId).toBe('uid-123')
    expect(parsed.detail).toBe('by_user')
    expect(typeof parsed.ts).toBe('string')
    // ts deve ser ISO 8601
    expect(() => new Date(parsed.ts)).not.toThrow()
  })

  it('omite campos undefined do JSON', () => {
    logSecurity({ type: 'csrf_block', endpoint: '/api/portal/mensagens' })

    const raw    = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const parsed = JSON.parse(raw)

    expect(parsed).not.toHaveProperty('ip')
    expect(parsed).not.toHaveProperty('userId')
    expect(parsed).not.toHaveProperty('detail')
  })

  it('inclui todos os tipos de evento válidos', () => {
    const tipos = [
      'csrf_block', 'rate_limit', 'orphan_session', 'invalid_uuid', 'abuse_attempt',
    ] as const

    for (const tipo of tipos) {
      logSecurity({ type: tipo, endpoint: '/test' })
    }

    expect(console.warn).toHaveBeenCalledTimes(tipos.length)

    const emittedTypes = (console.warn as ReturnType<typeof vi.fn>).mock.calls
      .map(([raw]) => JSON.parse(raw).type)
    expect(emittedTypes).toEqual(tipos)
  })

  it('é silencioso em ambiente de teste (NODE_ENV=test)', () => {
    vi.stubEnv('NODE_ENV', 'test')
    logSecurity({ type: 'csrf_block', endpoint: '/test' })
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('não expõe dados sensíveis: apenas campos permitidos', () => {
    logSecurity({
      type:     'abuse_attempt',
      endpoint: '/api/portal/mensagens',
      ip:       '10.0.0.1',
      userId:   'uid-abc',
      detail:   'repeated_block',
    })

    const raw    = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const parsed = JSON.parse(raw)
    const keys   = Object.keys(parsed)

    // Apenas esses campos devem aparecer — nunca email, token, conteúdo
    expect(keys.sort()).toEqual(
      ['detail', 'endpoint', 'ip', 'source', 'ts', 'type', 'userId'].sort()
    )
  })

  it('ts é timestamp ISO 8601 recente', () => {
    const before = Date.now()
    logSecurity({ type: 'rate_limit', endpoint: '/test' })
    const after  = Date.now()

    const raw    = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const parsed = JSON.parse(raw)
    const ts     = new Date(parsed.ts).getTime()

    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('ip null é omitido do JSON (não aparece como null)', () => {
    logSecurity({ type: 'rate_limit', endpoint: '/test', ip: null })

    const raw    = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const parsed = JSON.parse(raw)

    // ip null → campo ausente (não serializa como null)
    expect(parsed).not.toHaveProperty('ip')
  })
})
