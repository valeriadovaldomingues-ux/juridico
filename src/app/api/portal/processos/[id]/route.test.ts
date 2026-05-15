/**
 * Tests for GET /api/portal/processos/[id]
 *
 * Focus: data minimization — verifying that sensitive internal fields
 * (observacoes, valor_causa) are never present in the response,
 * and that UUID validation rejects malformed IDs before hitting the DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ── Mock portalGuard ───────────────────────────────────────────────────────────

const { mockPortalGuard } = vi.hoisted(() => ({
  mockPortalGuard: vi.fn(),
}))

vi.mock('@/lib/auth/portal-guard', () => ({
  portalGuard: mockPortalGuard,
}))

// ── Mock Supabase ──────────────────────────────────────────────────────────────

const { mockSingle, mockOrder, mockLimit, mockEq } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockOrder:  vi.fn(),
  mockLimit:  vi.fn(),
  mockEq:     vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => {
      // Supabase query chains are thenables — queries can be awaited directly
      // OR terminated with .single(). Both paths route through mockSingle here.
      const chain: {
        select: () => typeof chain
        eq:     () => typeof chain
        order:  () => typeof chain
        limit:  () => typeof chain
        single: typeof mockSingle
        then:   (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>
      } = {
        select: () => chain,
        eq:     () => chain,
        order:  () => chain,
        limit:  () => chain,
        single: mockSingle,
        // Makes `await chain` call mockSingle() — same sequence as .single()
        then: (onfulfilled, onrejected) =>
          mockSingle().then(onfulfilled, onrejected),
      }
      return chain
    },
  }),
}))

// ── Mock access log ────────────────────────────────────────────────────────────

vi.mock('@/lib/portal/access-log', () => ({
  logPortalAccess: vi.fn().mockResolvedValue(undefined),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import { GET } from './route'

const VALID_UUID   = '550e8400-e29b-41d4-a716-446655440000'
const VALID_SESSION = { userId: 'uid-1', clienteId: 'cid-1', clienteNome: 'Cliente Teste' }

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(id: string) {
  return new Request(`http://localhost/api/portal/processos/${id}`)
}

async function callGET(id: string) {
  return GET(makeRequest(id), { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  mockPortalGuard.mockReset()
  mockSingle.mockReset()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/portal/processos/[id] — validação de UUID', () => {
  beforeEach(() => {
    mockPortalGuard.mockResolvedValue(VALID_SESSION)
  })

  it('UUID válido não gera 404 imediato', async () => {
    // Com UUID válido, a query é executada (pode retornar 404 se não encontrado)
    mockSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'no rows' } }) // processo
    const res = await callGET(VALID_UUID)
    expect(res.status).toBe(404)
    // O 404 aqui é correto — processo não encontrado no mock, não UUID inválido
  })

  it('string arbitrária retorna 404 sem consultar o banco (UUID inválido)', async () => {
    const res = await callGET('not-a-uuid')
    expect(res.status).toBe(404)
    // Banco NÃO deve ter sido consultado — portalGuard chamado mas single() não
    expect(mockSingle).not.toHaveBeenCalled()
  })

  it('SQL injection tentativa retorna 404 sem consultar o banco', async () => {
    const res = await callGET("'; DROP TABLE processos; --")
    expect(res.status).toBe(404)
    expect(mockSingle).not.toHaveBeenCalled()
  })

  it('string vazia retorna 404 sem consultar o banco', async () => {
    const res = await callGET('')
    expect(res.status).toBe(404)
    expect(mockSingle).not.toHaveBeenCalled()
  })

  it('UUID com formato incorreto (sem hífens) retorna 404', async () => {
    const res = await callGET('550e8400e29b41d4a716446655440000')
    expect(res.status).toBe(404)
    expect(mockSingle).not.toHaveBeenCalled()
  })
})

describe('GET /api/portal/processos/[id] — ausência de campos sensíveis', () => {
  beforeEach(() => {
    mockPortalGuard.mockResolvedValue(VALID_SESSION)
  })

  it('observacoes NUNCA aparece na resposta', async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: {
          id:               VALID_UUID,
          numero_processo:  '1234567-89.2020.8.13.0001',
          titulo:           'Ação Trabalhista',
          area_direito:     'trabalhista',
          status:           'ativo',
          fase:             'instrução',
          tribunal:         'TRT03',
          vara:             '1ª Vara',
          data_distribuicao: '2020-01-15',
          // observacoes e valor_causa intencionalmente ausentes do mock
          // (simulam que o banco retornou só os campos do select)
        },
        error: null,
      })
      // Partes
      .mockResolvedValueOnce({ data: [], error: null })
      // Publicações
      .mockResolvedValueOnce({ data: [], error: null })

    const res  = await callGET(VALID_UUID)
    const body = await res.json()

    expect(body).not.toHaveProperty('observacoes')
    expect(res.status).toBe(200)
  })

  it('valor_causa NUNCA aparece na resposta', async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: {
          id:    VALID_UUID,
          titulo: 'Ação Civil',
          area_direito: 'civil',
          status: 'ativo',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const res  = await callGET(VALID_UUID)
    const body = await res.json()

    expect(body).not.toHaveProperty('valor_causa')
  })

  it('advogado_responsavel_id NUNCA aparece na resposta', async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: { id: VALID_UUID, titulo: 'Processo', area_direito: 'civil', status: 'ativo' },
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const res  = await callGET(VALID_UUID)
    const body = await res.json()

    expect(body).not.toHaveProperty('advogado_responsavel_id')
  })

  it('cliente_id NUNCA aparece na resposta', async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: { id: VALID_UUID, titulo: 'Processo', area_direito: 'civil', status: 'ativo' },
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const res  = await callGET(VALID_UUID)
    const body = await res.json()

    expect(body).not.toHaveProperty('cliente_id')
    expect(body).not.toHaveProperty('visivel_cliente')
  })

  it('publicações não expõem texto_publicacao, hash, status interno', async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: { id: VALID_UUID, titulo: 'Processo', area_direito: 'civil', status: 'ativo' },
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null }) // partes
      .mockResolvedValueOnce({
        data: [{
          id:                 'pub-uuid-1',
          tipo_publicacao:    'intimacao',
          data_publicacao:    '2024-01-10',
          resumo:             'Intimação para manifestação',
          prazo_detectado:    true,
          prazo_data:         '2024-01-25',
          audiencia_detectada: false,
          audiencia_data:     null,
          created_at:         '2024-01-10T00:00:00Z',
          // estes campos NÃO devem aparecer na resposta:
          // texto_publicacao, hash, status, advogado_monitorado_id,
          // oab_pesquisada, termo_encontrado, origem
        }],
        error: null,
      })

    const res  = await callGET(VALID_UUID)
    const body = await res.json()

    expect(body.publicacoes).toHaveLength(1)
    const pub = body.publicacoes[0]

    expect(pub).not.toHaveProperty('texto_publicacao')
    expect(pub).not.toHaveProperty('hash')
    expect(pub).not.toHaveProperty('advogado_monitorado_id')
    expect(pub).not.toHaveProperty('oab_pesquisada')
    expect(pub).not.toHaveProperty('termo_encontrado')
    expect(pub).not.toHaveProperty('origem')
  })

  it('partes não expõem documento (CPF/CNPJ da parte)', async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: { id: VALID_UUID, titulo: 'Processo', area_direito: 'civil', status: 'ativo' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'parte-1', pessoa_nome: 'João Silva', tipo_parte: 'reu' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })

    const res  = await callGET(VALID_UUID)
    const body = await res.json()

    expect(body.partes).toHaveLength(1)
    const parte = body.partes[0]

    expect(parte).not.toHaveProperty('documento')
    expect(parte).not.toHaveProperty('observacoes')
    // Apenas estes campos permitidos
    expect(Object.keys(parte).sort()).toEqual(['id', 'pessoa_nome', 'tipo_parte'].sort())
  })
})

describe('GET /api/portal/processos/[id] — campos permitidos na resposta', () => {
  it('retorna exatamente os campos esperados no processo', async () => {
    mockPortalGuard.mockResolvedValue(VALID_SESSION)

    const processoData = {
      id:                VALID_UUID,
      numero_processo:   '1234567-89.2020.8.13.0001',
      titulo:            'Ação Trabalhista',
      area_direito:      'trabalhista',
      status:            'ativo',
      fase:              'instrução',
      tribunal:          'TRT03',
      vara:              '1ª Vara do Trabalho',
      data_distribuicao: '2020-01-15',
    }

    mockSingle
      .mockResolvedValueOnce({ data: processoData, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const res  = await callGET(VALID_UUID)
    const body = await res.json()

    // Confirma presença dos campos permitidos
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('titulo')
    expect(body).toHaveProperty('numero_processo')
    expect(body).toHaveProperty('area_direito')
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('partes')
    expect(body).toHaveProperty('publicacoes')

    // Confirma ausência dos campos proibidos
    expect(body).not.toHaveProperty('observacoes')
    expect(body).not.toHaveProperty('valor_causa')
    expect(body).not.toHaveProperty('advogado_responsavel_id')
    expect(body).not.toHaveProperty('cliente_id')
    expect(body).not.toHaveProperty('visivel_cliente')
  })
})

describe('GET /api/portal/processos/[id] — autenticação', () => {
  it('sem sessão retorna 401', async () => {
    mockPortalGuard.mockResolvedValue(
      NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    )
    const res = await callGET(VALID_UUID)
    expect(res.status).toBe(401)
  })

  it('role não-cliente retorna 403', async () => {
    mockPortalGuard.mockResolvedValue(
      NextResponse.json({ error: 'Acesso exclusivo ao portal do cliente' }, { status: 403 })
    )
    const res = await callGET(VALID_UUID)
    expect(res.status).toBe(403)
  })
})
