/**
 * Rotas de dados do portal: SEMPRE filtram pelo clienteId da sessão (nunca pelo que vem na URL),
 * e não expõem nada interno.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { criarFakeDb, type FakeDb } from '@/lib/portal-cliente/testing/fake-db'
import { CLIENTE_A, CLIENTE_B, PROC_A1, PROC_A_OCULTO, PROC_A_SEGREDO, PROC_B1, seedBasico } from '@/lib/portal-cliente/testing/seed'

const h = vi.hoisted(() => ({ fake: null as unknown as { db: unknown }, sessao: null as null | { sessaoId: string; clienteId: string; clienteNome: string } }))

vi.mock('@/lib/portal-cliente/db', async orig => ({ ...(await orig<typeof import('@/lib/portal-cliente/db')>()), portalDb: () => h.fake.db }))
vi.mock('@/lib/auth/portal-guard', () => ({
  portalGuard: async () => h.sessao ?? NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 }),
  getPortalSession: async () => h.sessao,
}))

import { GET as listar } from './processos/route'
import { GET as detalhe } from './processos/[id]/route'
import { GET as agenda } from './agenda/route'
import { GET as me } from './me/route'
import { GET as relatorio } from './relatorio/route'
import { GET as relatorioHoras } from './relatorio-horas/route'
import { GET as documentos } from './documentos/route'
import { POST as solicitarEnvio } from './envios/route'
import { POST as confirmarEnvio } from './envios/[id]/confirmar/route'
import { GET as mensagens, POST as mensagensPost } from './mensagens/route'
import { POST as accessLog } from './access-log/route'
import { GET as auroraContexto } from './processos/[id]/aurora-cliente/contexto/route'
import { GET as auroraHistorico } from './processos/[id]/aurora-cliente/historico/route'
import { POST as auroraPerguntar } from './processos/[id]/aurora-cliente/perguntar/route'

let f: FakeDb
const sessaoDe = (clienteId: string, nome: string) => ({ sessaoId: 's', clienteId, clienteNome: nome })
const chamarDetalhe = (id: string) => detalhe(new Request(`http://localhost/api/portal/processos/${id}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.stubEnv('PORTAL_SEGREDO', 'segredo-de-teste')
  f = criarFakeDb({ ...seedBasico(), portal_acessos_log: [], portal_tentativas: [] })
  h.fake = f
  h.sessao = sessaoDe(CLIENTE_A, 'Maria da Silva')
})

describe('sem sessão', () => {
  it('todas as rotas de dados respondem 401', async () => {
    h.sessao = null
    expect((await listar()).status).toBe(401)
    expect((await chamarDetalhe(PROC_A1)).status).toBe(401)
    expect((await agenda()).status).toBe(401)
    expect((await me()).status).toBe(401)
    expect((await relatorio()).status).toBe(401)
    expect(f.consultas).toHaveLength(0)
  })
})

describe('GET /api/portal/processos', () => {
  it('devolve só os processos visíveis do cliente da sessão', async () => {
    const dados = await (await listar()).json()
    expect(dados.map((p: { id: string }) => p.id)).toEqual([PROC_A1])
  })
  it('outro cliente vê só os dele', async () => {
    h.sessao = sessaoDe(CLIENTE_B, 'Empresa B')
    expect((await (await listar()).json()).map((p: { id: string }) => p.id)).toEqual([PROC_B1])
  })
})

describe('GET /api/portal/processos/[id]', () => {
  it('processo do próprio cliente → 200 com partes e andamentos client-safe', async () => {
    const res = await chamarDetalhe(PROC_A1)
    expect(res.status).toBe(200)
    const dados = await res.json()
    expect(dados.id).toBe(PROC_A1)
    expect(dados.partes.map((p: { nome: string }) => p.nome)).toEqual(['Maria da Silva', 'Banco Réu S.A.'])
    expect(dados.andamentos.map((a: { id: string }) => a.id)).toEqual(['an1', 'an6'])
  })

  it('NÃO expõe campos internos', async () => {
    const texto = JSON.stringify(await (await chamarDetalhe(PROC_A1)).json())
    expect(texto).not.toMatch(/ESTRATEGIA|987654|valor_causa|observacoes|advogado|TEXTO INTERNO|nervoso|segredo da estrat|529\.982|nota interna|José Vínculo/)
  })

  it('tentar ler processo de OUTRO cliente → 404 (igual ao inexistente)', async () => {
    const outro = await chamarDetalhe(PROC_B1)
    const inexistente = await chamarDetalhe('ffffffff-0000-4000-8000-000000000000')
    expect(outro.status).toBe(404)
    expect({ status: outro.status, corpo: await outro.json() }).toEqual({ status: inexistente.status, corpo: await inexistente.json() })
  })

  it('o cliente B não lê o processo do cliente A', async () => {
    h.sessao = sessaoDe(CLIENTE_B, 'Empresa B')
    expect((await chamarDetalhe(PROC_A1)).status).toBe(404)
  })

  it('segredo de justiça e processo oculto → 404 mesmo sendo do cliente', async () => {
    expect((await chamarDetalhe(PROC_A_SEGREDO)).status).toBe(404)
    expect((await chamarDetalhe(PROC_A_OCULTO)).status).toBe(404)
  })

  it('id malformado → 404 sem consultar o banco', async () => {
    expect((await chamarDetalhe("1'; drop table processos;--")).status).toBe(404)
    expect((await chamarDetalhe('')).status).toBe(404)
    expect(f.consultas).toHaveLength(0)
  })

  it('migração ausente → 503 (sem 500)', async () => {
    f.falharTabela('processos', '42703')
    expect((await chamarDetalhe(PROC_A1)).status).toBe(503)
  })
})

describe('GET /api/portal/agenda e /me', () => {
  it('agenda: só audiências futuras dos processos visíveis do cliente', async () => {
    const dados = await (await agenda()).json()
    expect(dados.audiencias.map((a: { id: string }) => a.id)).toEqual(['ag1'])
    expect(JSON.stringify(dados)).not.toMatch(/TITULO INTERNO|DESCRICAO INTERNA|Cristiano/)
  })
  it('me: só o nome', async () => {
    expect(await (await me()).json()).toEqual({ nome: 'Maria da Silva' })
  })
})

describe('GET /api/portal/relatorio', () => {
  it('gera o PDF do cliente da sessão e registra o download', async () => {
    const res = await relatorio()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    const pdf = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()))
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('download_relatorio')
  })

  it('limite de 10 por hora por cliente → 429', async () => {
    for (let i = 0; i < 10; i++) expect((await relatorio()).status).toBe(200)
    expect((await relatorio()).status).toBe(429)
    h.sessao = sessaoDe(CLIENTE_B, 'Empresa B')
    expect((await relatorio()).status).toBe(200)
  })
})

describe('GET /api/portal/relatorio-horas', () => {
  const chamar = (q = '') => relatorioHoras(new NextRequest(`http://localhost/api/portal/relatorio-horas${q}`))
  it('401 sem sessão', async () => {
    h.sessao = null
    expect((await chamar()).status).toBe(401)
  })
  it('com a chave "mostrar horas" desligada para o cliente → 404 e nada é gerado nem registrado', async () => {
    f = criarFakeDb({ ...seedBasico(), portal_acessos_log: [], portal_tentativas: [], portal_acessos: [{ id: 'a1', cliente_id: CLIENTE_A, ativo: true, email_acesso: 'a@x.com', mostrar_horas: false }] })
    h.fake = f
    expect((await chamar()).status).toBe(404)
    expect(f.tabelas.portal_acessos_log).toHaveLength(0)
  })
  it('gera o PDF de horas só do cliente da sessão, sem valores, e registra o download', async () => {
    f = criarFakeDb({
      ...seedBasico(), portal_acessos_log: [], portal_tentativas: [], profiles: [{ id: 'u1', nome: 'Débora Brito', role: 'advogado' }],
      agenda_time_entries: [
        { id: 'h1', cliente_id: CLIENTE_A, cobravel: true, status_cobranca: 'a_faturar', inicio_em: '2026-11-10T13:00:00Z', duracao_calculada_minutos: 90, usa_duracao_manual: false, descricao_atividade: 'Petição', processo_id: PROC_A1, criado_por: 'u1', valor_hora: 450 },
        { id: 'h2', cliente_id: CLIENTE_B, cobravel: true, status_cobranca: 'a_faturar', inicio_em: '2026-11-10T13:00:00Z', duracao_calculada_minutos: 60, usa_duracao_manual: false, descricao_atividade: 'De outro cliente', processo_id: PROC_B1, criado_por: 'u1' },
      ],
    })
    h.fake = f
    const res = await chamar('?mes=2026-11')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('minhas-horas-2026-11')
    const pdf = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()))
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('download_relatorio')
  })
})

describe('envio de documentos pelo cliente (POST /api/portal/envios e /[id]/confirmar)', () => {
  let noStorage: string[]
  const corpo = (o: unknown) => new Request('http://localhost/api/portal/envios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) })
  const confirmar = (id: string) => confirmarEnvio(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id }) })
  beforeEach(() => {
    noStorage = []
    f = criarFakeDb({ ...seedBasico(), portal_acessos_log: [], portal_tentativas: [], portal_envios: [] })
    ;(f.db as unknown as { storage: unknown }).storage = {
      from: () => ({
        createSignedUploadUrl: async (c: string) => ({ data: { token: 'tok-' + c.length, path: c }, error: null }),
        list: async (_p: string, o: { search: string }) => ({ data: noStorage.filter(n => n === o.search).map(n => ({ name: n, metadata: { size: 5000 } })), error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    }
    h.fake = f
  })

  it('401 sem sessão (nenhuma tabela é consultada)', async () => {
    h.sessao = null
    expect((await solicitarEnvio(corpo({ nome: 'a.pdf', tamanho: 10 }))).status).toBe(401)
    expect((await confirmar(PROC_A1)).status).toBe(401)
    expect(f.consultas).toHaveLength(0)
  })

  it('fluxo completo: autoriza, o arquivo chega, confirma e aparece (e só para o cliente certo)', async () => {
    const r1 = await solicitarEnvio(corpo({ nome: 'RG.pdf', tamanho: 5000, descricao: 'frente e verso' }))
    expect(r1.status).toBe(200)
    const d = await r1.json()
    expect(d).toMatchObject({ bucket: 'portal-envios', contentType: 'application/pdf' })
    expect(d.caminho.startsWith(`${CLIENTE_A}/`)).toBe(true)
    expect(d.token).toBeTruthy()

    // outro cliente não consegue confirmar o envio do A
    h.sessao = sessaoDe(CLIENTE_B, 'Empresa B')
    expect((await confirmar(d.id)).status).toBe(404)
    h.sessao = sessaoDe(CLIENTE_A, 'Maria da Silva')

    expect((await confirmar(d.id)).status).toBe(409)             // ainda não chegou ao Storage
    noStorage.push(d.caminho.slice(d.caminho.lastIndexOf('/') + 1))
    expect((await confirmar(d.id)).status).toBe(200)
    expect(f.tabelas.portal_envios[0]).toMatchObject({ status: 'enviado', tamanho_bytes: 5000 })
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('envio_documento')
  })

  it('valida no servidor: tipo, tamanho e corpo inválido', async () => {
    expect((await solicitarEnvio(corpo({ nome: 'virus.exe', tamanho: 10 }))).status).toBe(415)
    expect((await solicitarEnvio(corpo({ nome: 'grande.pdf', tamanho: 30 * 1024 * 1024 }))).status).toBe(413)
    expect((await solicitarEnvio(corpo({ tamanho: 10 }))).status).toBe(400)
    expect((await solicitarEnvio(new Request('http://x', { method: 'POST', body: 'nao é json' }))).status).toBe(400)
    expect((await confirmar('nao-uuid')).status).toBe(404)
    expect(f.tabelas.portal_envios).toHaveLength(0)
  })

  it('processo de outro cliente → 404 e nada é criado', async () => {
    expect((await solicitarEnvio(corpo({ nome: 'a.pdf', tamanho: 10, processo_id: PROC_B1 }))).status).toBe(404)
    expect(f.tabelas.portal_envios).toHaveLength(0)
  })

  it('limite de 30 envios por hora por cliente → 429 (outro cliente não é afetado)', async () => {
    for (let i = 0; i < 30; i++) expect((await solicitarEnvio(corpo({ nome: 'a.pdf', tamanho: 10 }))).status).toBe(200)
    expect((await solicitarEnvio(corpo({ nome: 'a.pdf', tamanho: 10 }))).status).toBe(429)
    h.sessao = sessaoDe(CLIENTE_B, 'Empresa B')
    expect((await solicitarEnvio(corpo({ nome: 'a.pdf', tamanho: 10 }))).status).toBe(200)
  })

  it('"ver como cliente" (prévia do sócio) não envia nada → 403', async () => {
    h.sessao = { ...sessaoDe(CLIENTE_A, 'Maria da Silva'), previa: true } as never
    expect((await solicitarEnvio(corpo({ nome: 'a.pdf', tamanho: 10 }))).status).toBe(403)
    expect(f.tabelas.portal_envios).toHaveLength(0)
  })
})

describe('rotas fora da v1 (documentos, mensagens, Aurora, access-log antigo)', () => {
  it('respondem 404 "em breve" sem consultar nenhuma tabela', async () => {
    const ctx = { params: Promise.resolve({ id: PROC_A1 }) }
    const r = [
      await documentos(), await mensagens(), await mensagensPost(), await accessLog(),
      await auroraContexto(new Request('http://x'), ctx), await auroraHistorico(new Request('http://x'), ctx), await auroraPerguntar(new Request('http://x'), ctx),
    ]
    expect(r.map(x => x.status)).toEqual([404, 404, 404, 404, 404, 404, 404])
    expect(f.consultas).toHaveLength(0)
  })
})
