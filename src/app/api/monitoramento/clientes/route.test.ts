import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockApiGuard, mockCreateServiceClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: mockCreateServiceClient }))

import { GET, POST } from './route'

interface Estado {
  clientes: Array<{ id: string; cpf_cnpj: string | null }>
  ativos: Set<string>
  inseridos: Array<Record<string, unknown>>
  docs: unknown[]
  novos: Array<{ monitoramento_id: string }>
}

function banco(estado: Estado) {
  return {
    from(tabela: string) {
      let op = 'select'
      let linha: Record<string, unknown> | null = null
      const b: Record<string, unknown> = {
        select: () => b, not: () => b, order: () => b, eq: () => b, range: () => b,
        insert: (l: Record<string, unknown>) => { op = 'insert'; linha = l; return b },
        single: () => b,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(() => {
          if (tabela === 'clientes') return { data: estado.clientes, error: null }
          if (tabela === 'monitoramento_alertas') return { data: estado.novos, error: null }
          if (tabela === 'monitoramento_documentos' && op === 'select') return { data: estado.docs, error: null }
          if (tabela === 'monitoramento_documentos' && op === 'insert') {
            const doc = String(linha!.documento)
            if (estado.ativos.has(doc)) return { data: null, error: { code: '23505', message: 'duplicate' } }
            estado.ativos.add(doc)
            estado.inseridos.push(linha!)
            return { data: { id: `id-${estado.inseridos.length}`, ...linha }, error: null }
          }
          throw new Error(`consulta não prevista: ${tabela}`)
        }).then(res, rej),
      }
      return b
    },
  }
}

function post(corpo: unknown) {
  return new NextRequest('http://localhost/api/monitoramento/clientes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })
}

let estado: Estado
beforeEach(() => {
  estado = { clientes: [], ativos: new Set(), inseridos: [], docs: [], novos: [] }
  mockApiGuard.mockReset()
  mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'user-1' })
  mockCreateServiceClient.mockReset()
  mockCreateServiceClient.mockImplementation(() => banco(estado))
})

describe('POST /api/monitoramento/clientes', () => {
  it('só sócio e gerente cadastram (guard recebe esses papéis)', async () => {
    await POST(post({ documento: '11.222.333/0001-81', nome_principal: 'Empresa Exemplo' }))
    expect(mockApiGuard).toHaveBeenCalledWith(['socio', 'gerente'])
  })

  it('devolve a resposta do guard quando não autorizado', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))
    const res = await POST(post({ documento: '11.222.333/0001-81', nome_principal: 'Empresa Exemplo' }))
    expect(res.status).toBe(403)
    expect(estado.inseridos).toHaveLength(0)
  })

  it('cadastra vários, vincula o cliente pelos dígitos do CPF/CNPJ e relata os erros', async () => {
    estado.clientes = [{ id: 'cli-1', cpf_cnpj: '11.222.333/0001-81' }, { id: 'cli-2', cpf_cnpj: null }]
    const res = await POST(post({
      documentos: [
        { documento: '11222333000181', nome_principal: 'Empresa Exemplo Ltda', nomes_busca: ['Exemplo'] },
        { documento: '529.982.247-25', nome_principal: 'Maria da Silva' },
        { documento: '529.982.247-24', nome_principal: 'CPF errado' },
        { documento: '11.444.777/0001-61' },
      ],
    }))
    const corpo = await res.json()
    expect(res.status).toBe(201)
    expect(corpo.criados).toBe(2)
    expect(estado.inseridos[0]).toMatchObject({ documento: '11222333000181', tipo: 'cnpj', cliente_id: 'cli-1', created_by: 'user-1', nomes_busca: ['Exemplo'] })
    expect(estado.inseridos[1]).toMatchObject({ documento: '52998224725', tipo: 'cpf', cliente_id: null })
    expect(corpo.erros.map((e: { indice: number }) => e.indice)).toEqual([2, 3])
  })

  it('aceita um objeto só ou uma lista direta', async () => {
    expect((await POST(post({ documento: '11.222.333/0001-81', nome_principal: 'Empresa Exemplo' }))).status).toBe(201)
    expect((await POST(post([{ documento: '529.982.247-25', nome_principal: 'Maria da Silva' }]))).status).toBe(201)
  })

  it('documento já monitorado vira erro; repetido no mesmo pedido também', async () => {
    estado.ativos.add('11222333000181')
    const res = await POST(post([
      { documento: '11.222.333/0001-81', nome_principal: 'Empresa Exemplo' },
      { documento: '529.982.247-25', nome_principal: 'Maria da Silva' },
      { documento: '52998224725', nome_principal: 'Maria da Silva' },
    ]))
    const corpo = await res.json()
    expect(corpo.criados).toBe(1)
    expect(corpo.erros).toEqual([
      expect.objectContaining({ indice: 0, erro: expect.stringContaining('já está sendo monitorado') }),
      expect.objectContaining({ indice: 2, erro: expect.stringContaining('repetido') }),
    ])
  })

  it('400 quando nada é cadastrado ou o corpo é vazio', async () => {
    expect((await POST(post({ documento: '123', nome_principal: 'X' }))).status).toBe(400)
    expect((await POST(post([]))).status).toBe(400)
  })
})

describe('GET /api/monitoramento/clientes', () => {
  it('leitura liberada para sócio, gerente, advogado e administrativo, com contagem de alertas novos', async () => {
    estado.docs = [{ id: 'd1', nome_principal: 'Acme', cliente: [{ id: 'c1', nome: 'Acme SA' }] }, { id: 'd2', nome_principal: 'Beta', cliente: null }]
    estado.novos = [{ monitoramento_id: 'd1' }, { monitoramento_id: 'd1' }]
    const res = await GET()
    const corpo = await res.json()
    expect(mockApiGuard).toHaveBeenCalledWith(['socio', 'gerente', 'advogado', 'administrativo'])
    expect(corpo.documentos).toEqual([
      expect.objectContaining({ id: 'd1', alertas_novos: 2, cliente: { id: 'c1', nome: 'Acme SA' } }),
      expect.objectContaining({ id: 'd2', alertas_novos: 0, cliente: null }),
    ])
  })
})
