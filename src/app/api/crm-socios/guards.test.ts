/**
 * CRM Cris e Val — guards das API routes.
 *
 * Usa o apiGuard REAL (só o Supabase é simulado). Garante que:
 *  - sem sessão → 401;
 *  - conta inativa / sem perfil → 403;
 *  - qualquer papel que não seja 'socio' → 403, SEM encostar em nenhuma tabela crm_socios_*;
 *  - sócio passa pelo guard (e, com o módulo ainda não ativado no banco, recebe 503 amigável — não 500).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { estado, tabelasTocadas } = vi.hoisted(() => ({
  estado: {
    user: null as { id: string } | null,
    profile: null as { role: string; ativo: boolean } | null,
    /** Erro devolvido pelas tabelas crm_socios_* (simula a migração ainda não aplicada). */
    erroTabela: { code: 'PGRST205', message: "Could not find the table 'public.crm_socios_oportunidades' in the schema cache" } as { code: string; message: string } | null,
  },
  tabelasTocadas: [] as string[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.user } }) },
    from: (tabela: string) => {
      tabelasTocadas.push(tabela)
      const resultado = tabela === 'profiles'
        ? { data: estado.profile, error: null }
        : { data: null, error: estado.erroTabela }
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'gte', 'lte']) chain[m] = () => chain
      chain.maybeSingle = async () => resultado
      chain.single = async () => resultado
      chain.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado).then(ok, ko)
      return chain
    },
  }),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))

import * as oportunidades from './oportunidades/route'
import * as oportunidade from './oportunidades/[id]/route'
import * as interacoesDaOportunidade from './oportunidades/[id]/interacoes/route'
import * as interacao from './interacoes/[id]/route'
import * as propostas from './propostas/route'
import * as proposta from './propostas/[id]/route'

const ID = '11111111-1111-4111-8111-111111111111'
const ctx = { params: Promise.resolve({ id: ID }) }

function chamada(metodo: string, corpo?: unknown) {
  return new NextRequest(`http://localhost:3000/api/crm-socios/x`, {
    method: metodo,
    ...(corpo !== undefined ? { body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } } : {}),
  })
}

const VALIDOS = {
  oportunidade: { nome: 'Empresa Teste' },
  interacao: { tipo: 'nota', descricao: 'Conversa inicial' },
  proposta: { oportunidade_id: ID, titulo: 'Proposta' },
}

// Todas as rotas/métodos do módulo.
const ROTAS: Array<[string, () => Promise<Response>]> = [
  ['GET /oportunidades', () => oportunidades.GET(chamada('GET'))],
  ['POST /oportunidades', () => oportunidades.POST(chamada('POST', VALIDOS.oportunidade))],
  ['GET /oportunidades/[id]', () => oportunidade.GET(chamada('GET'), ctx)],
  ['PATCH /oportunidades/[id]', () => oportunidade.PATCH(chamada('PATCH', { notas: 'x' }), ctx)],
  ['DELETE /oportunidades/[id]', () => oportunidade.DELETE(chamada('DELETE'), ctx)],
  ['POST /oportunidades/[id]/interacoes', () => interacoesDaOportunidade.POST(chamada('POST', VALIDOS.interacao), ctx)],
  ['DELETE /interacoes/[id]', () => interacao.DELETE(chamada('DELETE'), ctx)],
  ['POST /propostas', () => propostas.POST(chamada('POST', VALIDOS.proposta))],
  ['PATCH /propostas/[id]', () => proposta.PATCH(chamada('PATCH', { titulo: 'Novo' }), ctx)],
  ['DELETE /propostas/[id]', () => proposta.DELETE(chamada('DELETE'), ctx)],
]

const PAPEIS_BARRADOS = ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'cliente']

beforeEach(() => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY // apiGuard cai no client simulado
  estado.user = null
  estado.profile = null
  estado.erroTabela = { code: 'PGRST205', message: "Could not find the table 'public.crm_socios_oportunidades' in the schema cache" }
  tabelasTocadas.length = 0
})

afterEach(() => { vi.clearAllMocks() })

const tabelasDoModulo = () => tabelasTocadas.filter(t => t.startsWith('crm_socios_'))

describe('sem sessão', () => {
  it.each(ROTAS)('%s → 401', async (_nome, chamar) => {
    const res = await chamar()
    expect(res.status).toBe(401)
    expect(tabelasDoModulo()).toEqual([])
  })
})

describe('papéis que NÃO são sócio', () => {
  for (const papel of PAPEIS_BARRADOS) {
    it.each(ROTAS)(`${papel}: %s → 403, sem tocar nas tabelas do módulo`, async (_nome, chamar) => {
      estado.user = { id: 'u1' }
      estado.profile = { role: papel, ativo: true }
      const res = await chamar()
      expect(res.status).toBe(403)
      expect(tabelasDoModulo()).toEqual([])
    })
  }
})

describe('contas que não valem', () => {
  it.each(ROTAS)('sócio inativo: %s → 403', async (_nome, chamar) => {
    estado.user = { id: 'u1' }
    estado.profile = { role: 'socio', ativo: false }
    expect((await chamar()).status).toBe(403)
    expect(tabelasDoModulo()).toEqual([])
  })

  it.each(ROTAS)('usuário sem perfil: %s → 403', async (_nome, chamar) => {
    estado.user = { id: 'u1' }
    estado.profile = null
    expect((await chamar()).status).toBe(403)
    expect(tabelasDoModulo()).toEqual([])
  })
})

describe('sócio', () => {
  it.each(ROTAS)('%s passa pelo guard e, com a migração não aplicada, devolve 503 (não 500)', async (_nome, chamar) => {
    estado.user = { id: 'u1' }
    estado.profile = { role: 'socio', ativo: true }
    const res = await chamar()
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.codigo).toBe('modulo_nao_ativado')
    expect(tabelasDoModulo().length).toBeGreaterThan(0)
  })

  it('corpo inválido → 400 (validação roda depois do guard)', async () => {
    estado.user = { id: 'u1' }
    estado.profile = { role: 'socio', ativo: true }
    const res = await oportunidades.POST(chamada('POST', { nome: '   ' }))
    expect(res.status).toBe(400)
  })

  it('id que não é UUID → 400', async () => {
    estado.user = { id: 'u1' }
    estado.profile = { role: 'socio', ativo: true }
    const res = await oportunidade.GET(chamada('GET'), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('perda sem motivo é recusada com 400', async () => {
    estado.user = { id: 'u1' }
    estado.profile = { role: 'socio', ativo: true }
    estado.erroTabela = null
    const res = await oportunidades.POST(chamada('POST', { nome: 'X', etapa: 'perdido' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/motivo/i)
  })
})
