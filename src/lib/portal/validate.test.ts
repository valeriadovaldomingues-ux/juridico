import { describe, it, expect } from 'vitest'
import {
  isUUID,
  requireUUID,
  checkContentLength,
  checkStringLength,
  extractIP,
  truncateUserAgent,
  LIMITS,
} from './validate'

// ── isUUID ────────────────────────────────────────────────────────────────────

describe('isUUID', () => {
  it('aceita UUID v4 válido lowercase', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('aceita UUID v4 válido uppercase', () => {
    expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('aceita UUID v4 com letras minúsculas e maiúsculas misturadas', () => {
    expect(isUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true)
  })

  it('rejeita string sem hífens', () => {
    expect(isUUID('550e8400e29b41d4a716446655440000')).toBe(false)
  })

  it('rejeita UUID com comprimento incorreto', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(isUUID('')).toBe(false)
  })

  it('rejeita null', () => {
    expect(isUUID(null)).toBe(false)
  })

  it('rejeita undefined', () => {
    expect(isUUID(undefined)).toBe(false)
  })

  it('rejeita número', () => {
    expect(isUUID(12345)).toBe(false)
  })

  it('rejeita UUID com caracteres especiais injetados', () => {
    expect(isUUID("' OR 1=1 --")).toBe(false)
  })

  it('rejeita UUID com caracteres fora do hex', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-44665544zzzz')).toBe(false)
  })
})

// ── requireUUID ───────────────────────────────────────────────────────────────

describe('requireUUID', () => {
  it('retorna ok: true para UUID válido', () => {
    const result = requireUUID('550e8400-e29b-41d4-a716-446655440000', 'campo')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('retorna ok: false com mensagem de erro para valor inválido', () => {
    const result = requireUUID('not-a-uuid', 'campo')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('campo')
  })

  it('inclui o nome do campo no erro', () => {
    const result = requireUUID('', 'processo_id')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('processo_id')
  })
})

// ── checkContentLength ────────────────────────────────────────────────────────

describe('checkContentLength', () => {
  function makeRequest(contentLength: string | null) {
    const headers = new Headers()
    if (contentLength !== null) headers.set('content-length', contentLength)
    return new Request('http://localhost/test', { method: 'POST', headers })
  }

  it('retorna null quando content-length está dentro do limite', () => {
    const req = makeRequest('1000')
    expect(checkContentLength(req)).toBeNull()
  })

  it('retorna erro quando content-length excede o limite padrão', () => {
    const req = makeRequest(String(LIMITS.BODY_BYTES + 1))
    expect(checkContentLength(req)).not.toBeNull()
  })

  it('retorna null quando content-length está ausente', () => {
    const req = makeRequest(null)
    expect(checkContentLength(req)).toBeNull()
  })

  it('respeita limite customizado', () => {
    const req = makeRequest('500')
    expect(checkContentLength(req, 400)).not.toBeNull()
    expect(checkContentLength(req, 600)).toBeNull()
  })

  it('retorna null exatamente no limite', () => {
    const req = makeRequest(String(LIMITS.BODY_BYTES))
    expect(checkContentLength(req)).toBeNull()
  })
})

// ── checkStringLength ─────────────────────────────────────────────────────────

describe('checkStringLength', () => {
  it('retorna null para string dentro do limite', () => {
    expect(checkStringLength('ok', 100, 'campo')).toBeNull()
  })

  it('retorna erro para string acima do limite', () => {
    const longa = 'a'.repeat(LIMITS.MENSAGEM_CHARS + 1)
    const result = checkStringLength(longa, LIMITS.MENSAGEM_CHARS, 'conteudo')
    expect(result).not.toBeNull()
    expect(result).toContain('conteudo')
    expect(result).toContain(String(LIMITS.MENSAGEM_CHARS))
  })

  it('retorna null exatamente no limite', () => {
    const exato = 'x'.repeat(LIMITS.MENSAGEM_CHARS)
    expect(checkStringLength(exato, LIMITS.MENSAGEM_CHARS, 'conteudo')).toBeNull()
  })
})

// ── extractIP ─────────────────────────────────────────────────────────────────

describe('extractIP', () => {
  function makeRequest(headers: Record<string, string>) {
    return new Request('http://localhost/', { headers })
  }

  it('extrai o PRIMEIRO IP de x-forwarded-for (não o do cliente)', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.0.1.2' })
    expect(extractIP(req)).toBe('1.2.3.4')
  })

  it('usa x-real-ip quando x-forwarded-for está ausente', () => {
    const req = makeRequest({ 'x-real-ip': '10.0.0.1' })
    expect(extractIP(req)).toBe('10.0.0.1')
  })

  it('retorna null quando nenhum header de IP está presente', () => {
    const req = makeRequest({})
    expect(extractIP(req)).toBeNull()
  })

  it('remove espaços ao redor do IP extraído', () => {
    const req = makeRequest({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' })
    expect(extractIP(req)).toBe('1.2.3.4')
  })

  it('x-forwarded-for vazio retorna null (sem crash)', () => {
    const req = makeRequest({ 'x-forwarded-for': '' })
    expect(extractIP(req)).toBeNull()
  })
})

// ── truncateUserAgent ─────────────────────────────────────────────────────────

describe('truncateUserAgent', () => {
  it('não trunca user-agent dentro do limite', () => {
    const ua = 'Mozilla/5.0 (normal agent)'
    expect(truncateUserAgent(ua)).toBe(ua)
  })

  it('trunca user-agent acima do limite', () => {
    const ua = 'A'.repeat(LIMITS.USER_AGENT + 100)
    const result = truncateUserAgent(ua)
    expect(result).toHaveLength(LIMITS.USER_AGENT)
  })

  it('retorna null para null', () => {
    expect(truncateUserAgent(null)).toBeNull()
  })

  it('trunca exatamente no limite', () => {
    const ua = 'B'.repeat(LIMITS.USER_AGENT)
    expect(truncateUserAgent(ua)).toHaveLength(LIMITS.USER_AGENT)
  })
})
