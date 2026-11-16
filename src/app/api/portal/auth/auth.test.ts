/**
 * Rotas de login do portal: solicitar, verificar, pedido-acesso e sair.
 * Banco em memória; e-mail e segundo plano simulados (nenhum e-mail real).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, type NextResponse } from 'next/server'
import { criarFakeDb, type FakeDb } from '@/lib/portal-cliente/testing/fake-db'
import { CLIENTE_A, CNPJ_B, CPF_A, CPF_A_DIGITOS, seedBasico } from '@/lib/portal-cliente/testing/seed'
import { COOKIE_SESSAO } from '@/lib/portal-cliente/constantes'
import { sha256 } from '@/lib/portal-cliente/segredos'

const h = vi.hoisted(() => ({
  fake: null as unknown as { db: unknown },
  enviados: [] as { to: string[]; subject: string; text: string }[],
  pendentes: [] as Promise<void>[],
  notificacoes: [] as unknown[],
}))

vi.mock('@/lib/portal-cliente/db', async orig => ({ ...(await orig<typeof import('@/lib/portal-cliente/db')>()), portalDb: () => h.fake.db }))
vi.mock('@/lib/portal-cliente/tempo', () => ({ normalizarTempo: vi.fn(async () => {}) }))
vi.mock('@/lib/portal-cliente/segundo-plano', () => ({ emSegundoPlano: (t: () => Promise<void>) => { h.pendentes.push(t().catch(() => {})) } }))
vi.mock('@/lib/email/mailer', async orig => ({
  ...(await orig<typeof import('@/lib/email/mailer')>()),
  emailConfigurado: () => true,
  enviarEmail: vi.fn(async (m: { to: string[]; subject: string; text: string }) => { h.enviados.push(m); return { messageId: 'x' } }),
}))
vi.mock('@/lib/notificacoes', () => ({ notificarRoles: vi.fn(async (...a: unknown[]) => { h.notificacoes.push(a); return 0 }) }))

import { POST as solicitar } from './solicitar/route'
import { POST as verificar } from './verificar/route'
import { POST as pedidoAcesso } from './pedido-acesso/route'
import { POST as sair } from './sair/route'

const EMAIL_ACESSO = 'acesso@maria.com'
let f: FakeDb

function post(url: string, corpo: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: JSON.stringify(corpo),
  })
}
const pedirCodigo = (corpo: unknown, headers?: Record<string, string>) => solicitar(post('/api/portal/auth/solicitar', corpo, headers))
const tentar = (documento: string, codigo: string, headers?: Record<string, string>) => verificar(post('/api/portal/auth/verificar', { documento, codigo }, headers))
async function esperar() { await Promise.all(h.pendentes.splice(0)) }
const codigoDoUltimoEmail = () => /\b(\d{6})\b/.exec(h.enviados.at(-1)?.text ?? '')?.[1] ?? ''

function liberarMaria(extra: Record<string, unknown> = {}) {
  f.tabelas.portal_acessos.push({ id: 'ac1', cliente_id: CLIENTE_A, email_acesso: EMAIL_ACESSO, ativo: true, ...extra })
}

beforeEach(() => {
  vi.stubEnv('PORTAL_SEGREDO', 'segredo-de-teste')
  f = criarFakeDb({ ...seedBasico(), portal_acessos: [], profiles: [{ id: 's1', role: 'socio', ativo: true, email: 'socio@pedv.com' }, { id: 'a1', role: 'advogado', ativo: true, email: 'adv@pedv.com' }] })
  h.fake = f
  h.enviados.length = 0
  h.pendentes.length = 0
  h.notificacoes.length = 0
})

describe('POST /api/portal/auth/solicitar', () => {
  it('cliente LIBERADO recebe o código só no e-mail de acesso liberado', async () => {
    liberarMaria()
    const res = await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(res.status).toBe(200)
    expect(h.enviados).toHaveLength(1)
    expect(h.enviados[0].to).toEqual([EMAIL_ACESSO])
    expect(codigoDoUltimoEmail()).toMatch(/^\d{6}$/)
    expect(h.enviados[0].text).not.toContain(CPF_A_DIGITOS)
    expect(f.tabelas.portal_codigos).toHaveLength(1)
    expect(JSON.stringify(f.tabelas.portal_codigos)).not.toContain(codigoDoUltimoEmail())
  })

  it('e-mail digitado na hora NUNCA recebe código (a rota ignora e-mail do corpo)', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A, email: 'atacante@evil.com', to: 'atacante@evil.com', emailAcesso: 'atacante@evil.com' })
    await esperar()
    expect(h.enviados.flatMap(m => m.to)).toEqual([EMAIL_ACESSO])
    expect(JSON.stringify(h.enviados)).not.toContain('atacante@evil.com')
  })

  it('MODO PILOTO: cliente com clientes.email mas SEM liberação não recebe nada', async () => {
    // Maria tem e-mail no cadastro (maria@cadastro.com), mas ninguém a liberou.
    const res = await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(res.status).toBe(200)
    expect(h.enviados).toHaveLength(0)
    expect(f.tabelas.portal_codigos ?? []).toHaveLength(0)
  })

  it('o e-mail do cadastro nunca é usado, mesmo com liberação (vale o e-mail de acesso aprovado)', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(JSON.stringify(h.enviados)).not.toContain('maria@cadastro.com')
  })

  it('resposta IDÊNTICA para documento liberado, sem liberação e inexistente', async () => {
    liberarMaria()
    const liberado = await pedirCodigo({ documento: CPF_A })
    const semLiberacao = await pedirCodigo({ documento: CNPJ_B })
    const inexistente = await pedirCodigo({ documento: '111.444.777-35' })
    const corpos = await Promise.all([liberado, semLiberacao, inexistente].map(async r => ({ status: r.status, corpo: await r.json() })))
    expect(corpos[1]).toEqual(corpos[0])
    expect(corpos[2]).toEqual(corpos[0])
    expect(corpos[0].status).toBe(200)
  })

  it('documento duplicado em dois cadastros liberados → ambíguo → nada é enviado', async () => {
    liberarMaria()
    f.tabelas.clientes.push({ id: 'dup', nome: 'Maria Duplicada', ativo: true, cpf_cnpj: CPF_A_DIGITOS, email: null })
    f.tabelas.portal_acessos.push({ id: 'ac2', cliente_id: 'dup', email_acesso: 'outro@x.com', ativo: true })
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(h.enviados).toHaveLength(0)
  })

  it('documento duplicado mas só UM cadastro liberado → usa o liberado', async () => {
    liberarMaria()
    f.tabelas.clientes.push({ id: 'dup', nome: 'Maria Duplicada', ativo: true, cpf_cnpj: CPF_A_DIGITOS, email: 'dup@x.com' })
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(h.enviados.map(m => m.to[0])).toEqual([EMAIL_ACESSO])
  })

  it('acesso revogado, cliente inativo ou liberação sem e-mail válido → nada é enviado', async () => {
    liberarMaria({ ativo: false })
    await pedirCodigo({ documento: CPF_A })
    f.tabelas.portal_acessos[0].ativo = true
    f.tabelas.clientes[0].ativo = false
    await pedirCodigo({ documento: CPF_A })
    f.tabelas.clientes[0].ativo = true
    f.tabelas.portal_acessos[0].email_acesso = 'isto-nao-e-email'
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(h.enviados).toHaveLength(0)
  })

  it('acha o cliente quando o cadastro guarda o CPF com máscara OU só dígitos', async () => {
    liberarMaria()
    f.tabelas.clientes[0].cpf_cnpj = CPF_A_DIGITOS
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(h.enviados).toHaveLength(1)
  })

  it('documento com dígito verificador errado → 400, sem tocar no banco de clientes', async () => {
    const res = await pedirCodigo({ documento: '529.982.247-24' })
    expect(res.status).toBe(400)
    expect(f.consultas.filter(c => c.tabela === 'clientes')).toHaveLength(0)
  })

  it('corpo inválido → 400', async () => {
    const res = await solicitar(new NextRequest('http://localhost:3000/api/portal/auth/solicitar', { method: 'POST', headers: { origin: 'http://localhost:3000' }, body: 'nao-e-json' }))
    expect(res.status).toBe(400)
  })

  it('anti-abuso: 5 por hora por documento, depois 429 (igual para documento inexistente)', async () => {
    for (let i = 0; i < 5; i++) expect((await pedirCodigo({ documento: '111.444.777-35' }, { 'x-forwarded-for': `10.0.0.${i}` })).status).toBe(200)
    expect((await pedirCodigo({ documento: '111.444.777-35' }, { 'x-forwarded-for': '10.0.0.99' })).status).toBe(429)
  })

  it('anti-abuso: 20 por hora por IP', async () => {
    const docs = ['529.982.247-25', '111.444.777-35', '11.222.333/0001-81', '390.533.447-05']
    let bloqueou = false
    for (let i = 0; i < 25; i++) {
      const r = await pedirCodigo({ documento: docs[i % 4] })
      if (r.status === 429) { bloqueou = true; expect(i).toBeGreaterThanOrEqual(20); break }
    }
    expect(bloqueou).toBe(true)
  })

  it('bloqueia origem externa (CSRF)', async () => {
    const res = await pedirCodigo({ documento: CPF_A }, { origin: 'https://evil.example' })
    expect(res.status).toBe(403)
  })

  it('migração não aplicada → 503 amigável, sem 500', async () => {
    f.falharTabela('portal_tentativas', '42P01')
    const res = await pedirCodigo({ documento: CPF_A })
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/ainda não está disponível/)
  })

  it('falha de envio não muda a resposta', async () => {
    liberarMaria()
    const { enviarEmail } = await import('@/lib/email/mailer')
    vi.mocked(enviarEmail).mockRejectedValueOnce(new Error('smtp fora'))
    const res = await pedirCodigo({ documento: CPF_A })
    await esperar()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/portal/auth/verificar', () => {
  it('código certo cria a sessão: cookie httpOnly/lax, só o hash no banco, último acesso e log', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    const res = await tentar(CPF_A, codigoDoUltimoEmail())
    expect(res.status).toBe(200)

    const cookie = (res as NextResponse).cookies.get(COOKIE_SESSAO)
    expect(cookie?.value.length).toBeGreaterThanOrEqual(40) // 32 bytes em base64url
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('lax')
    expect(cookie?.path).toBe('/')

    expect(f.tabelas.portal_sessoes).toHaveLength(1)
    expect(f.tabelas.portal_sessoes[0].token_hash).toBe(sha256(cookie!.value))
    expect(JSON.stringify(f.tabelas.portal_sessoes)).not.toContain(cookie!.value)
    const dur = new Date(f.tabelas.portal_sessoes[0].expira_em as string).getTime() - new Date(f.tabelas.portal_sessoes[0].criado_em as string).getTime()
    expect(dur).toBe(12 * 60 * 60 * 1000)
    expect(f.tabelas.portal_acessos[0].ultimo_acesso).toBeTruthy()
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('login')
    expect(JSON.stringify(f.tabelas.portal_sessoes)).not.toContain('203.0.113.7') // IP resumido
  })

  it('o mesmo código não entra duas vezes', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    const codigo = codigoDoUltimoEmail()
    expect((await tentar(CPF_A, codigo)).status).toBe(200)
    expect((await tentar(CPF_A, codigo)).status).toBe(401)
  })

  it('erro único e genérico: código errado, documento inexistente e documento sem liberação', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    const certo = codigoDoUltimoEmail()
    const errado = certo === '000000' ? '000001' : '000000'
    const respostas = await Promise.all([
      tentar(CPF_A, errado), tentar('111.444.777-35', errado), tentar(CNPJ_B, errado), tentar('lixo', errado), tentar(CPF_A, 'abc'),
    ].map(async p => { const r = await p; return { status: r.status, corpo: await r.json() } }))
    for (const r of respostas) expect(r).toEqual(respostas[0])
    expect(respostas[0].status).toBe(401)
    expect(f.tabelas.portal_sessoes ?? []).toHaveLength(0)
  })

  it('depois de 5 erros o código morre, mesmo digitando o certo', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    const certo = codigoDoUltimoEmail()
    const errado = certo === '000000' ? '000001' : '000000'
    for (let i = 0; i < 5; i++) await tentar(CPF_A, errado, { 'x-forwarded-for': `10.1.0.${i}` })
    expect((await tentar(CPF_A, certo, { 'x-forwarded-for': '10.1.0.77' })).status).toBe(401)
  })

  it('código expirado não entra', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    f.tabelas.portal_codigos[0].expira_em = new Date(Date.now() - 1000).toISOString()
    expect((await tentar(CPF_A, codigoDoUltimoEmail())).status).toBe(401)
  })

  it('acesso revogado depois do código: não entra', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    f.tabelas.portal_acessos[0].ativo = false
    expect((await tentar(CPF_A, codigoDoUltimoEmail())).status).toBe(401)
  })

  it('anti-abuso: 15 tentativas por hora por documento, depois 429', async () => {
    for (let i = 0; i < 15; i++) await tentar('111.444.777-35', '123456', { 'x-forwarded-for': `10.2.0.${i}` })
    expect((await tentar('111.444.777-35', '123456', { 'x-forwarded-for': '10.2.0.200' })).status).toBe(429)
  })

  it('bloqueia origem externa (CSRF)', async () => {
    expect((await tentar(CPF_A, '123456', { origin: 'https://evil.example' })).status).toBe(403)
  })

  it('migração ausente → 503', async () => {
    f.falharTabela('portal_tentativas', '42P01')
    expect((await tentar(CPF_A, '123456')).status).toBe(503)
  })
})

const PEDIDO = { documento: CPF_A, nascimento: '20/05/1980', nome_mae: 'Ana da Silva', nome_pai: 'João da Silva', email: 'quem-pediu@exemplo.com', telefone: '(31) 99999-0000' }

describe('POST /api/portal/auth/pedido-acesso', () => {
  it('cria pedido PENDENTE e NÃO envia código a ninguém (muito menos ao e-mail digitado)', async () => {
    const res = await pedidoAcesso(post('/api/portal/auth/pedido-acesso', PEDIDO))
    await esperar()
    expect(res.status).toBe(200)
    expect(f.tabelas.portal_pedidos_acesso).toHaveLength(1)
    expect(f.tabelas.portal_pedidos_acesso[0]).toMatchObject({ status: 'pendente', documento: CPF_A_DIGITOS, email: 'quem-pediu@exemplo.com', nascimento: '1980-05-20' })
    expect(f.tabelas.portal_codigos ?? []).toHaveLength(0)
    expect(h.enviados.flatMap(m => m.to)).not.toContain('quem-pediu@exemplo.com')
  })

  it('avisa só os sócios por e-mail, com resumo sem dados do solicitante', async () => {
    await pedidoAcesso(post('/api/portal/auth/pedido-acesso', PEDIDO))
    await esperar()
    expect(h.enviados).toHaveLength(1)
    expect(h.enviados[0].to).toEqual(['socio@pedv.com'])
    const texto = JSON.stringify(h.enviados[0])
    expect(texto).not.toContain(CPF_A_DIGITOS)
    expect(texto).not.toContain('quem-pediu')
    expect(texto).not.toContain('Ana da Silva')
    expect(h.notificacoes).toHaveLength(1)
  })

  it('SMTP ausente: o pedido é salvo e nada quebra', async () => {
    const mailer = await import('@/lib/email/mailer')
    const spy = vi.spyOn(mailer, 'emailConfigurado').mockReturnValue(false)
    const res = await pedidoAcesso(post('/api/portal/auth/pedido-acesso', PEDIDO))
    await esperar()
    spy.mockRestore()
    expect(res.status).toBe(200)
    expect(f.tabelas.portal_pedidos_acesso).toHaveLength(1)
    expect(h.enviados).toHaveLength(0)
  })

  it('resposta idêntica para documento existente e inexistente', async () => {
    const a = await pedidoAcesso(post('/api/portal/auth/pedido-acesso', PEDIDO, { 'x-forwarded-for': '10.3.0.1' }))
    const b = await pedidoAcesso(post('/api/portal/auth/pedido-acesso', { ...PEDIDO, documento: '111.444.777-35', email: 'outro@exemplo.com' }, { 'x-forwarded-for': '10.3.0.2' }))
    expect({ status: b.status, corpo: await b.json() }).toEqual({ status: a.status, corpo: await a.json() })
  })

  it('não duplica pedido igual nas últimas 24 h', async () => {
    await pedidoAcesso(post('/api/portal/auth/pedido-acesso', PEDIDO, { 'x-forwarded-for': '10.3.1.1' }))
    await pedidoAcesso(post('/api/portal/auth/pedido-acesso', PEDIDO, { 'x-forwarded-for': '10.3.1.2' }))
    expect(f.tabelas.portal_pedidos_acesso).toHaveLength(1)
  })

  it('valida campos (documento, nascimento, mãe, e-mail)', async () => {
    for (const ruim of [
      { ...PEDIDO, documento: '123' }, { ...PEDIDO, nascimento: '31/02/1980' }, { ...PEDIDO, nascimento: '20/05/2999' },
      { ...PEDIDO, nome_mae: '' }, { ...PEDIDO, email: 'nao-e-email' }, { ...PEDIDO, telefone: '12' },
    ]) {
      expect((await pedidoAcesso(post('/api/portal/auth/pedido-acesso', ruim, { 'x-forwarded-for': '10.3.2.1' }))).status).toBe(400)
    }
    expect(f.tabelas.portal_pedidos_acesso ?? []).toHaveLength(0)
  })

  it('isca de robô preenchida: responde igual e não grava', async () => {
    const res = await pedidoAcesso(post('/api/portal/auth/pedido-acesso', { ...PEDIDO, website: 'http://spam' }))
    expect(res.status).toBe(200)
    expect(f.tabelas.portal_pedidos_acesso ?? []).toHaveLength(0)
  })

  it('anti-abuso por e-mail: 3 por hora', async () => {
    const docs = ['529.982.247-25', '111.444.777-35', '390.533.447-05', '11.222.333/0001-81']
    const status: number[] = []
    for (let i = 0; i < 4; i++) status.push((await pedidoAcesso(post('/api/portal/auth/pedido-acesso', { ...PEDIDO, documento: docs[i] }, { 'x-forwarded-for': `10.4.0.${i}` }))).status)
    expect(status).toEqual([200, 200, 200, 429])
  })

  it('bloqueia origem externa (CSRF)', async () => {
    expect((await pedidoAcesso(post('/api/portal/auth/pedido-acesso', PEDIDO, { origin: 'https://evil.example' }))).status).toBe(403)
  })
})

describe('POST /api/portal/auth/sair', () => {
  it('revoga a sessão e apaga o cookie', async () => {
    liberarMaria()
    await pedirCodigo({ documento: CPF_A })
    await esperar()
    const login = await tentar(CPF_A, codigoDoUltimoEmail())
    const token = (login as NextResponse).cookies.get(COOKIE_SESSAO)!.value
    const res = await sair(new NextRequest('http://localhost:3000/api/portal/auth/sair', { method: 'POST', headers: { origin: 'http://localhost:3000', cookie: `${COOKIE_SESSAO}=${token}` } }))
    expect(res.status).toBe(200)
    expect(f.tabelas.portal_sessoes[0].revogada_em).toBeTruthy()
    expect((res as NextResponse).cookies.get(COOKIE_SESSAO)?.value).toBe('')
  })

  it('sem cookie também responde 200', async () => {
    expect((await sair(new NextRequest('http://localhost:3000/api/portal/auth/sair', { method: 'POST', headers: { origin: 'http://localhost:3000' } }))).status).toBe(200)
  })
})
