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
    expect(body.error).toContain('confirme a revisão')
  })

  it('bloqueia geração sem nome de quem revisou', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'uid' })

    const res = await POST(request({
      confirmouRevisao: true,
      dados: {
        tipoDocumento: 'contrato_partido',
        clienteTipo: 'pj',
        nomeRazaoSocial: 'Empresa Teste Ltda.',
        cpfCnpj: '00.000.000/0001-00',
        endereco: 'Rua Teste, 100',
        honorarios: 'R$ 5.000,00',
        vencimento: '10',
        primeiraParcela: '10/06/2026',
        vigenciaInicio: '01/06/2026',
        todasAreas: true,
        percentualExito: '10%',
      },
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('nome de quem revisou')
  })
})
