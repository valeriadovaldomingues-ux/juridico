import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCompletarJSON } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCompletarJSON: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

vi.mock('@/lib/ai/service', () => ({
  completarJSON: mockCompletarJSON,
}))

import { POST } from './route'

function request(form: FormData) {
  return new Request('http://localhost/api/documentos/extrair-dados', {
    method: 'POST',
    body: form,
  })
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCompletarJSON.mockReset()
})

describe('POST /api/documentos/extrair-dados', () => {
  it('bloqueia usuário não autorizado', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))
    const form = new FormData()
    form.set('tipoDocumento', 'contrato_partido')
    form.set('relato', 'Cliente Empresa Teste.')

    const res = await POST(request(form))

    expect(res.status).toBe(403)
    expect(mockCompletarJSON).not.toHaveBeenCalled()
  })

  it('não inventa CPF/CNPJ ausente na extração', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'uid' })
    mockCompletarJSON.mockResolvedValue(JSON.stringify({
      tipoDocumento: 'contrato_partido',
      nomeRazaoSocial: 'Empresa Teste Ltda.',
      camposAusentes: ['CPF/CNPJ'],
      alertas: [],
      confianca: 0.6,
    }))
    const form = new FormData()
    form.set('tipoDocumento', 'contrato_partido')
    form.set('relato', 'Cliente Empresa Teste Ltda. Sem documento informado.')

    const res = await POST(request(form))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.dados.cpfCnpj).toBe('')
    expect(body.camposAusentes).toContain('CPF/CNPJ')
  })

  it('recusa upload com extensão não permitida', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'uid' })
    const form = new FormData()
    form.set('tipoDocumento', 'peticao_comum')
    form.set('relato', 'Texto')
    form.append('arquivos', new File(['x'], 'dados.txt', { type: 'text/plain' }))

    const res = await POST(request(form))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Arquivo não permitido')
  })
})
