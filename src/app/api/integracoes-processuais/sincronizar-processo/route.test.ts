import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient, mockInsert } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/integracoes-processuais/sincronizar-processo', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockInsert.mockReset()
  mockCreateClient.mockResolvedValue({
    from: vi.fn(() => ({ insert: mockInsert })),
  })
  mockInsert.mockResolvedValue({ error: null })
})

describe('POST /api/integracoes-processuais/sincronizar-processo', () => {
  it('rejeita usuario sem permissao', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissao' }, { status: 403 }))

    const res = await POST(request({ provider: 'mock', numeroCnj: '0000000-00.2026.8.13.0000' }))

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejeita credenciais sensiveis no body', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })

    const res = await POST(request({
      provider: 'mock',
      numeroCnj: '0000000-00.2026.8.13.0000',
      tokenTribunal: 'nao-aceitar',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Nao envie tokens')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('sincroniza com mock e cria log sem dados sensiveis', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })

    const res = await POST(request({ provider: 'mock', numeroCnj: '0000000-00.2026.8.13.0000' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resultado.provider).toBe('mock')
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      provider: 'mock',
      tipo_operacao: 'sincronizar_processo',
      status: 'sucesso',
      referencia: '0000000-00.2026.8.13.0000',
      criado_por: 'uid-socio',
    })
    expect(JSON.stringify(mockInsert.mock.calls[0][0])).not.toMatch(/token|senha|cookie|certificado/i)
  })
})
