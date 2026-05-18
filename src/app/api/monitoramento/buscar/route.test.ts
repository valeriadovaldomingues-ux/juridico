import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const {
  mockApiGuard,
  mockCreateClient,
  mockBuscarPublicacoesTJMG,
} = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockBuscarPublicacoesTJMG: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/monitoramento/tjmg-dje', () => ({
  buscarPublicacoesTJMG: mockBuscarPublicacoesTJMG,
  gerarHashDJE: vi.fn(() => 'hash-dje'),
}))

vi.mock('@/lib/monitoramento/prazo-detector', () => ({
  detectarPrazosEAudiencias: vi.fn(() => ({
    prazo_detectado: false,
    prazo_dias: null,
    prazo_data: null,
    prazo_descricao: null,
    audiencia_detectada: false,
    audiencia_data: null,
    audiencia_descricao: null,
  })),
  detectarTipoResultado: vi.fn(() => 'publicacao'),
  analisarPublicacao: vi.fn(() => ({ resumo: [] })),
}))

import { POST } from './route'

function request(headers?: HeadersInit) {
  return new Request('http://localhost/api/monitoramento/buscar', {
    method: 'POST',
    headers,
  })
}

function supabaseSemAdvogados() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'advogados_monitorados') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }

      throw new Error(`Tabela inesperada no teste: ${table}`)
    }),
  }
}

beforeEach(() => {
  delete process.env.CRON_SECRET
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockBuscarPublicacoesTJMG.mockReset()
  mockBuscarPublicacoesTJMG.mockResolvedValue([])
})

describe('POST /api/monitoramento/buscar', () => {
  it('permite que roles da matriz de monitoramento passem pelo guard da API', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue(supabaseSemAdvogados())

    const res = await POST(request())
    const body = await res.json()

    expect(mockApiGuard).toHaveBeenCalledWith(['advogado', 'gerente', 'socio'])
    expect(res.status).toBe(400)
    expect(body.erro).toBe('Nenhum advogado ativo para monitorar')
  })

  it('mantém cliente e demais perfis não autorizados bloqueados', async () => {
    mockApiGuard.mockResolvedValue(
      NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 }),
    )

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.erro).toBe('Sem permissão para acionar o monitoramento')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('mantém usuário sem sessão bloqueado', async () => {
    mockApiGuard.mockResolvedValue(
      NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    )

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.erro).toBe('Não autorizado')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('preserva chamada por cron com CRON_SECRET sem exigir sessão', async () => {
    process.env.CRON_SECRET = 'secret'
    mockCreateClient.mockResolvedValue(supabaseSemAdvogados())

    const res = await POST(request({ authorization: 'Bearer secret' }))

    expect(mockApiGuard).not.toHaveBeenCalled()
    expect(res.status).toBe(400)
  })
})
