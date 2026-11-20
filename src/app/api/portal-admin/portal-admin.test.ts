/**
 * Rotas do ESCRITÓRIO para gerir o portal: só quem está em PORTAL_PAPEIS_GESTAO (hoje: sócio).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { criarFakeDb, type FakeDb } from '@/lib/portal-cliente/testing/fake-db'
import { CLIENTE_A, CPF_A_DIGITOS, seedBasico } from '@/lib/portal-cliente/testing/seed'

const h = vi.hoisted(() => ({
  fake: null as unknown as { db: unknown },
  role: 'socio' as string | null,
  enviados: [] as { to: string[] }[],
}))

vi.mock('@/lib/portal-cliente/db', async orig => ({ ...(await orig<typeof import('@/lib/portal-cliente/db')>()), portalDb: () => h.fake.db }))
vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: async (roles: string[]) => {
    if (!h.role) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    return roles.includes(h.role) ? { role: h.role, userId: 's0000000-0000-4000-8000-000000000001' } : NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 })
  },
}))
vi.mock('@/lib/email/mailer', async orig => ({
  ...(await orig<typeof import('@/lib/email/mailer')>()),
  emailConfigurado: () => true,
  enviarEmail: vi.fn(async (m: { to: string[] }) => { h.enviados.push(m); return { messageId: 'x' } }),
}))

import { GET as listarPedidos } from './pedidos/route'
import { POST as decidir } from './pedidos/[id]/route'
import { POST as acaoCliente } from './clientes/[id]/route'

const PEDIDO_ID = 'e0000000-0000-4000-8000-000000000001'
let f: FakeDb

const req = (corpo: unknown) => new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
const decidirPedido = (corpo: unknown, id = PEDIDO_ID) => decidir(req(corpo), { params: Promise.resolve({ id }) })
const acionar = (corpo: unknown, id = CLIENTE_A) => acaoCliente(req(corpo), { params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.stubEnv('PORTAL_SEGREDO', 'segredo-de-teste')
  f = criarFakeDb({
    ...seedBasico(), portal_acessos: [], portal_codigos: [], portal_sessoes: [],
    portal_pedidos_acesso: [{ id: PEDIDO_ID, documento: CPF_A_DIGITOS, email: 'pediu@x.com', nascimento: '1980-05-20', nome_mae: 'Ana', nome_pai: null, status: 'pendente', criado_em: '2026-11-14T10:00:00Z' }],
  })
  h.fake = f
  h.role = 'socio'
  h.enviados.length = 0
})

describe('permissão: só o sócio', () => {
  it.each(['administrativo', 'advogado', 'gerente', 'estagiario', 'comercial'])('%s recebe 403 em todas as rotas', async role => {
    h.role = role
    expect((await listarPedidos()).status).toBe(403)
    expect((await decidirPedido({ acao: 'rejeitar' })).status).toBe(403)
    expect((await acionar({ acao: 'revogar' })).status).toBe(403)
    expect((await acionar({ acao: 'definir_horas', mostrar: false })).status).toBe(403)
    expect(f.consultas).toHaveLength(0)
    expect(f.tabelas.portal_pedidos_acesso[0].status).toBe('pendente')
  })

  it('sem login → 401', async () => {
    h.role = null
    expect((await listarPedidos()).status).toBe(401)
    expect((await acionar({ acao: 'revogar' })).status).toBe(401)
  })
})

describe('sócio', () => {
  it('lista a fila', async () => {
    const dados = await (await listarPedidos()).json()
    expect(dados.pedidos).toHaveLength(1)
    expect(dados.pedidos[0].candidatos[0].id).toBe(CLIENTE_A)
  })

  it('aprova: envia o primeiro código SÓ ao e-mail de acesso informado e apaga os dados de conferência', async () => {
    const res = await decidirPedido({ acao: 'aprovar', cliente_id: CLIENTE_A, email_acesso: 'oficial@maria.com', confirmado_com_cliente: true })
    expect(res.status).toBe(200)
    expect((await res.json()).codigoEnviado).toBe(true)
    expect(h.enviados.map(m => m.to)).toEqual([['oficial@maria.com']])
    expect(f.tabelas.portal_pedidos_acesso[0]).toMatchObject({ status: 'aprovado', nascimento: null, nome_mae: null })
  })

  it('aprovar sem confirmar com o cliente → 400', async () => {
    expect((await decidirPedido({ acao: 'aprovar', cliente_id: CLIENTE_A })).status).toBe(400)
    expect(h.enviados).toHaveLength(0)
  })

  it('rejeita e apaga os dados', async () => {
    expect((await decidirPedido({ acao: 'rejeitar' })).status).toBe(200)
    expect(f.tabelas.portal_pedidos_acesso[0]).toMatchObject({ status: 'rejeitado', nascimento: null, nome_mae: null })
  })

  it('liga/desliga a aba Horas do cliente (só boolean; exige acesso liberado)', async () => {
    expect((await acionar({ acao: 'definir_horas', mostrar: false })).status).toBe(409)
    await acionar({ acao: 'liberar', email_acesso: 'a@maria.com' })
    expect((await acionar({ acao: 'definir_horas', mostrar: 'nao' })).status).toBe(400)
    expect((await acionar({ acao: 'definir_horas' })).status).toBe(400)
    const res = await acionar({ acao: 'definir_horas', mostrar: false })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, mostrarHoras: false })
    expect(f.tabelas.portal_acessos[0].mostrar_horas).toBe(false)
  })

  it('ação inválida / ids malformados → 400/404', async () => {
    expect((await decidirPedido({ acao: 'apagar' })).status).toBe(400)
    expect((await decidirPedido({ acao: 'rejeitar' }, 'nao-uuid')).status).toBe(404)
    expect((await decidirPedido({ acao: 'aprovar', cliente_id: 'x' })).status).toBe(400)
  })

  it('libera, encerra sessões e revoga pela ficha do cliente', async () => {
    const libera = await acionar({ acao: 'liberar', email_acesso: 'a@maria.com', enviar_codigo: true })
    expect(libera.status).toBe(200)
    expect(h.enviados.map(m => m.to)).toEqual([['a@maria.com']])
    expect((await acionar({ acao: 'encerrar_sessoes' })).status).toBe(200)
    expect((await acionar({ acao: 'revogar' })).status).toBe(200)
    expect(f.tabelas.portal_acessos[0].ativo).toBe(false)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toEqual(expect.arrayContaining(['acesso_liberado', 'sessoes_encerradas', 'acesso_revogado']))
    expect(f.tabelas.portal_acessos_log.every(l => l.usuario_id === 's0000000-0000-4000-8000-000000000001' || l.usuario_id == null)).toBe(true)
  })

  it('migração ausente → 503 amigável', async () => {
    f.falharTabela('portal_pedidos_acesso', '42P01')
    expect((await listarPedidos()).status).toBe(503)
  })
})
