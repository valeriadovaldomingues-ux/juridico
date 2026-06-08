import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClienteContato, mockListClienteContatos } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClienteContato: vi.fn(),
  mockListClienteContatos: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/cliente-contatos', () => ({
  canEditClienteContatos: (role: string) => role === 'socio',
  canViewClienteContatos: (role: string) => role !== 'cliente',
  createClienteContato: mockCreateClienteContato,
  listClienteContatos: mockListClienteContatos,
}))

import { GET, POST } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClienteContato.mockReset()
  mockListClienteContatos.mockReset()
})

describe('GET /api/clientes/[id]/contatos', () => {
  it('bloqueia perfis sem permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(new Request('http://localhost/api/clientes/cli-1/contatos'), {
      params: Promise.resolve({ id: 'cli-1' }),
    } as any)

    expect(res.status).toBe(403)
    expect(mockListClienteContatos).not.toHaveBeenCalled()
  })

  it('lista contatos para usuário interno', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockListClienteContatos.mockResolvedValue([{ id: 'c1', nome: 'Contato 1' }])

    const res = await GET(new Request('http://localhost/api/clientes/cli-1/contatos'), {
      params: Promise.resolve({ id: 'cli-1' }),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(mockListClienteContatos).toHaveBeenCalledWith('cli-1')
  })
})

describe('POST /api/clientes/[id]/contatos', () => {
  it('cria contato para perfil autorizado', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockCreateClienteContato.mockResolvedValue({ id: 'c1', nome: 'Contato 1' })

    const res = await POST(new Request('http://localhost/api/clientes/cli-1/contatos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Contato 1' }),
    }), {
      params: Promise.resolve({ id: 'cli-1' }),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('c1')
    expect(mockCreateClienteContato).toHaveBeenCalledWith('cli-1', expect.objectContaining({ nome: 'Contato 1' }), 'uid')
  })
})
