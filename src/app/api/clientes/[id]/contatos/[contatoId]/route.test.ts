import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockDeleteClienteContato, mockGetClienteContato, mockUpdateClienteContato } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockDeleteClienteContato: vi.fn(),
  mockGetClienteContato: vi.fn(),
  mockUpdateClienteContato: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/cliente-contatos', () => ({
  canEditClienteContatos: (role: string) => role === 'socio',
  deleteClienteContato: mockDeleteClienteContato,
  getClienteContato: mockGetClienteContato,
  updateClienteContato: mockUpdateClienteContato,
}))

import { DELETE, PATCH } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockDeleteClienteContato.mockReset()
  mockGetClienteContato.mockReset()
  mockUpdateClienteContato.mockReset()
})

describe('PATCH /api/clientes/[id]/contatos/[contatoId]', () => {
  it('bloqueia perfis sem permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await PATCH(new Request('http://localhost/api/clientes/cli-1/contatos/c1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Contato 1' }),
    }), {
      params: Promise.resolve({ id: 'cli-1', contatoId: 'c1' }),
    } as any)

    expect(res.status).toBe(403)
    expect(mockUpdateClienteContato).not.toHaveBeenCalled()
  })

  it('atualiza contato para usuário interno autorizado', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockUpdateClienteContato.mockResolvedValue({ id: 'c1', nome: 'Contato 1 atualizado' })

    const res = await PATCH(new Request('http://localhost/api/clientes/cli-1/contatos/c1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Contato 1 atualizado' }),
    }), {
      params: Promise.resolve({ id: 'cli-1', contatoId: 'c1' }),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nome).toBe('Contato 1 atualizado')
    expect(mockUpdateClienteContato).toHaveBeenCalledWith('cli-1', 'c1', expect.objectContaining({ nome: 'Contato 1 atualizado' }), 'uid')
  })
})

describe('DELETE /api/clientes/[id]/contatos/[contatoId]', () => {
  it('bloqueia perfis sem permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await DELETE(new Request('http://localhost/api/clientes/cli-1/contatos/c1'), {
      params: Promise.resolve({ id: 'cli-1', contatoId: 'c1' }),
    } as any)

    expect(res.status).toBe(403)
    expect(mockDeleteClienteContato).not.toHaveBeenCalled()
  })

  it('exclui contato existente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockGetClienteContato.mockResolvedValue({ id: 'c1', contato_principal: false })
    mockDeleteClienteContato.mockResolvedValue(true)

    const res = await DELETE(new Request('http://localhost/api/clientes/cli-1/contatos/c1'), {
      params: Promise.resolve({ id: 'cli-1', contatoId: 'c1' }),
    } as any)

    expect(res.status).toBe(204)
    expect(mockGetClienteContato).toHaveBeenCalledWith('cli-1', 'c1')
    expect(mockDeleteClienteContato).toHaveBeenCalledWith('cli-1', 'c1')
  })
})
