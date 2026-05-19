import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/documentos/gerar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockApiGuard.mockReset()
})

describe('POST /api/documentos/gerar', () => {
  it('bloqueia usuário não autorizado', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await POST(request({ confirmouRevisao: true, dados: { tipoDocumento: 'peticao_comum' } }))

    expect(res.status).toBe(403)
  })

  it('bloqueia geração sem confirmação humana', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'uid' })

    const res = await POST(request({
      confirmouRevisao: false,
      dados: { tipoDocumento: 'peticao_comum', nomeRazaoSocial: 'Cliente' },
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Revise os dados')
  })
})
