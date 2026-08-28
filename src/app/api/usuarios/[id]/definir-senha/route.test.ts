import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockApiGuard, mockCreateServiceClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: mockCreateServiceClient }))

import { POST } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/usuarios/user-1/definir-senha', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateServiceClient.mockReset()
})

describe('POST /api/usuarios/[id]/definir-senha', () => {
  it('bloqueia usuário sem permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await POST(req({ senha: 'segredo123' }), { params: Promise.resolve({ id: 'user-1' }) })

    expect(res.status).toBe(403)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('rejeita senha ausente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'admin-1' })

    const res = await POST(req({}), { params: Promise.resolve({ id: 'user-1' }) })

    expect(res.status).toBe(400)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('rejeita senha curta (menos de 6 caracteres)', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'admin-1' })

    const res = await POST(req({ senha: '123' }), { params: Promise.resolve({ id: 'user-1' }) })

    expect(res.status).toBe(400)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('sócio consegue definir senha diretamente, sem e-mail', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'admin-1' })
    const updateUserById = vi.fn(async () => ({ error: null }))
    mockCreateServiceClient.mockReturnValue({ auth: { admin: { updateUserById } } })

    const res = await POST(req({ senha: 'segredo123' }), { params: Promise.resolve({ id: 'user-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(updateUserById).toHaveBeenCalledWith('user-1', { password: 'segredo123' })
  })

  it('gerente também consegue definir senha', async () => {
    mockApiGuard.mockResolvedValue({ role: 'gerente', userId: 'admin-1' })
    const updateUserById = vi.fn(async () => ({ error: null }))
    mockCreateServiceClient.mockReturnValue({ auth: { admin: { updateUserById } } })

    const res = await POST(req({ senha: 'segredo123' }), { params: Promise.resolve({ id: 'user-1' }) })

    expect(res.status).toBe(200)
  })

  it('propaga erro do Supabase Admin API', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'admin-1' })
    const updateUserById = vi.fn(async () => ({ error: { message: 'Usuário não encontrado' } }))
    mockCreateServiceClient.mockReturnValue({ auth: { admin: { updateUserById } } })

    const res = await POST(req({ senha: 'segredo123' }), { params: Promise.resolve({ id: 'user-inexistente' }) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Usuário não encontrado')
  })
})
