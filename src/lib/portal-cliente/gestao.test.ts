import { beforeEach, describe, expect, it } from 'vitest'
import { criarFakeDb, type FakeDb } from './testing/fake-db'
import { CLIENTE_A, CLIENTE_B, CPF_A_DIGITOS, seedBasico } from './testing/seed'
import { decidirPedido, definirMostrarHoras, encerrarSessoes, liberarAcesso, listarPedidosPendentes, revogarAcesso, statusAcesso } from './gestao'
import { conferirCodigo } from './codigo'
import { criarSessao, validarToken } from './sessao'
import { PORTAL_PAPEIS_GESTAO, podeGerenciarPortal } from './constantes'

const SOCIO = 's0000000-0000-4000-8000-000000000001'
let f: FakeDb

function pedido(extra: Record<string, unknown> = {}) {
  const linha = {
    id: 'e0000000-0000-4000-8000-000000000001', documento: CPF_A_DIGITOS, email: 'pediu@x.com', telefone: '31999990000',
    nascimento: '1980-05-20', nome_mae: 'Ana da Silva', nome_pai: 'João da Silva', status: 'pendente', criado_em: '2026-11-14T10:00:00Z', ...extra,
  }
  f.tabelas.portal_pedidos_acesso.push(linha)
  return linha.id as string
}

beforeEach(() => {
  process.env.PORTAL_SEGREDO = 'segredo-de-teste'
  f = criarFakeDb({ ...seedBasico(), portal_acessos: [], portal_pedidos_acesso: [], portal_codigos: [], portal_sessoes: [] })
})

describe('quem gerencia o portal (constante única)', () => {
  it('por enquanto só o sócio', () => {
    expect(PORTAL_PAPEIS_GESTAO).toEqual(['socio'])
    expect(podeGerenciarPortal('socio')).toBe(true)
    for (const r of ['administrativo', 'advogado', 'gerente', 'estagiario', 'comercial', 'cliente', '', null, undefined]) {
      expect(podeGerenciarPortal(r as string | null | undefined)).toBe(false)
    }
  })
})

describe('fila de pedidos', () => {
  it('lista candidatos pelo documento e confere o nascimento sem revelar o valor guardado', async () => {
    pedido()
    const [p] = await listarPedidosPendentes(f.db)
    expect(p.candidatos).toHaveLength(1)
    expect(p.candidatos[0]).toMatchObject({ id: CLIENTE_A, nascimento: 'confere', liberado: false })
    expect(JSON.stringify(p.candidatos)).not.toContain('1980-05-20')
  })

  it('"não confere" e "sem dado" quando for o caso', async () => {
    pedido({ nascimento: '1990-01-01' })
    f.tabelas.clientes[0].cpf_cnpj = CPF_A_DIGITOS
    expect((await listarPedidosPendentes(f.db))[0].candidatos[0].nascimento).toBe('nao_confere')
    f.tabelas.clientes[0].data_nascimento = null
    expect((await listarPedidosPendentes(f.db))[0].candidatos[0].nascimento).toBe('sem_dado')
  })

  it('documento sem cadastro → sem candidatos', async () => {
    pedido({ documento: '11144477735' })
    expect((await listarPedidosPendentes(f.db))[0].candidatos).toEqual([])
  })

  it('só pendentes entram na fila', async () => {
    pedido({ status: 'aprovado' })
    expect(await listarPedidosPendentes(f.db)).toEqual([])
  })
})

describe('decidir pedido', () => {
  it('APROVAR: libera com o e-mail informado, apaga nascimento/mãe/pai, gera o primeiro código e registra no log', async () => {
    const id = pedido()
    const r = await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'aprovar', clienteId: CLIENTE_A, emailAcesso: 'oficial@maria.com', confirmadoComCliente: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.codigoParaEnviar?.para).toBe('oficial@maria.com')
    expect(f.tabelas.portal_acessos[0]).toMatchObject({ cliente_id: CLIENTE_A, email_acesso: 'oficial@maria.com', ativo: true, aprovado_por: SOCIO })
    const ped = f.tabelas.portal_pedidos_acesso[0]
    expect(ped).toMatchObject({ status: 'aprovado', cliente_id: CLIENTE_A, decidido_por: SOCIO, nascimento: null, nome_mae: null, nome_pai: null })
    expect(JSON.stringify(ped)).not.toMatch(/Ana da Silva|João da Silva|1980/)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('pedido_aprovado')
    expect(await conferirCodigo(f.db, CLIENTE_A, r.codigoParaEnviar!.codigo)).toBe(true)
  })

  it('REJEITAR: apaga os dados de conferência e registra', async () => {
    const id = pedido()
    const r = await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'rejeitar' })
    expect(r.ok).toBe(true)
    expect(f.tabelas.portal_pedidos_acesso[0]).toMatchObject({ status: 'rejeitado', decidido_por: SOCIO, nascimento: null, nome_mae: null, nome_pai: null })
    expect(f.tabelas.portal_acessos).toHaveLength(0)
    expect(f.tabelas.portal_codigos).toHaveLength(0)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('pedido_rejeitado')
  })

  it('aprovar exige a confirmação com o cliente por telefone/WhatsApp', async () => {
    const id = pedido()
    const r = await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'aprovar', clienteId: CLIENTE_A, confirmadoComCliente: false })
    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(r.ok === false && r.erro).toMatch(/Confirme com o cliente por telefone ou WhatsApp/)
    expect(f.tabelas.portal_pedidos_acesso[0].status).toBe('pendente')
    expect(f.tabelas.portal_pedidos_acesso[0].nome_mae).toBe('Ana da Silva') // nada apagado sem decisão
  })

  it('o cliente escolhido precisa ter o documento do pedido', async () => {
    const id = pedido()
    const r = await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'aprovar', clienteId: CLIENTE_B, confirmadoComCliente: true })
    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(f.tabelas.portal_acessos).toHaveLength(0)
    expect(f.tabelas.portal_pedidos_acesso[0].status).toBe('pendente')
  })

  it('o e-mail de acesso vem do sócio (padrão: o do pedido), nunca do cadastro', async () => {
    const id = pedido()
    const r = await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'aprovar', clienteId: CLIENTE_A, confirmadoComCliente: true })
    expect(r.ok && r.codigoParaEnviar?.para).toBe('pediu@x.com')
  })

  it('e-mail inválido → 400 e nada muda', async () => {
    const id = pedido()
    const r = await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'aprovar', clienteId: CLIENTE_A, emailAcesso: 'xxx', confirmadoComCliente: true })
    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(f.tabelas.portal_pedidos_acesso[0].status).toBe('pendente')
  })

  it('pedido já decidido → 409; inexistente → 404', async () => {
    const id = pedido()
    await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'rejeitar' })
    expect(await decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'aprovar', clienteId: CLIENTE_A, confirmadoComCliente: true })).toMatchObject({ ok: false, status: 409 })
    expect(await decidirPedido(f.db, { pedidoId: 'nao-existe', usuarioId: SOCIO, acao: 'rejeitar' })).toMatchObject({ ok: false, status: 404 })
  })

  it('duas decisões em paralelo: só uma vence', async () => {
    const id = pedido()
    const [a, b] = await Promise.all([
      decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'aprovar', clienteId: CLIENTE_A, confirmadoComCliente: true }),
      decidirPedido(f.db, { pedidoId: id, usuarioId: SOCIO, acao: 'rejeitar' }),
    ])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
  })
})

describe('liberar / revogar / encerrar sessões', () => {
  it('liberar manualmente grava o e-mail de acesso e o log, e pode enviar um primeiro código', async () => {
    const r = await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'Acesso@Maria.com', usuarioId: SOCIO, enviarCodigo: true })
    expect(r.ok && r.codigoParaEnviar?.para).toBe('acesso@maria.com')
    expect(f.tabelas.portal_acessos[0]).toMatchObject({ cliente_id: CLIENTE_A, email_acesso: 'acesso@maria.com', ativo: true, aprovado_por: SOCIO })
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('acesso_liberado')
  })

  it('liberar de novo atualiza a mesma linha (um acesso por cliente)', async () => {
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'b@x.com', usuarioId: SOCIO, enviarCodigo: false })
    expect(f.tabelas.portal_acessos).toHaveLength(1)
    expect(f.tabelas.portal_acessos[0].email_acesso).toBe('b@x.com')
  })

  it('recusa e-mail inválido, cliente inexistente, inativo e sem documento válido', async () => {
    expect(await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'xx', usuarioId: SOCIO, enviarCodigo: false })).toMatchObject({ ok: false, status: 400 })
    expect(await liberarAcesso(f.db, { clienteId: 'nao-existe', emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })).toMatchObject({ ok: false, status: 404 })
    f.tabelas.clientes[1].ativo = false
    expect(await liberarAcesso(f.db, { clienteId: CLIENTE_B, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })).toMatchObject({ ok: false, status: 400 })
    f.tabelas.clientes[0].cpf_cnpj = '123'
    expect(await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })).toMatchObject({ ok: false, status: 400 })
    expect(f.tabelas.portal_acessos).toHaveLength(0)
  })

  it('não libera um cadastro duplicado se OUTRO com o mesmo documento já está liberado', async () => {
    f.tabelas.clientes.push({ id: 'dup', nome: 'Duplicada', ativo: true, cpf_cnpj: CPF_A_DIGITOS })
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    expect(await liberarAcesso(f.db, { clienteId: 'dup', emailAcesso: 'b@x.com', usuarioId: SOCIO, enviarCodigo: false })).toMatchObject({ ok: false, status: 409 })
  })

  it('revogar bloqueia, derruba as sessões e invalida códigos', async () => {
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: true })
    const { token } = await criarSessao(f.db, CLIENTE_A)
    expect(await validarToken(f.db, token)).not.toBeNull()
    const r = await revogarAcesso(f.db, CLIENTE_A, SOCIO)
    expect(r.sessoesEncerradas).toBe(1)
    expect(f.tabelas.portal_acessos[0]).toMatchObject({ ativo: false })
    expect(await validarToken(f.db, token)).toBeNull()
    expect(f.tabelas.portal_codigos.every(c => c.invalidado_em)).toBe(true)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('acesso_revogado')
  })

  it('revogar cliente que nunca foi liberado cria a linha bloqueada (sem e-mail)', async () => {
    await revogarAcesso(f.db, CLIENTE_B, SOCIO)
    expect(f.tabelas.portal_acessos[0]).toMatchObject({ cliente_id: CLIENTE_B, ativo: false, email_acesso: null })
  })

  it('encerrar sessões derruba o login mas mantém a liberação', async () => {
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    const { token } = await criarSessao(f.db, CLIENTE_A)
    expect((await encerrarSessoes(f.db, CLIENTE_A, SOCIO)).sessoesEncerradas).toBe(1)
    expect(await validarToken(f.db, token)).toBeNull()
    expect(f.tabelas.portal_acessos[0].ativo).toBe(true)
  })

  it('status do acesso para a ficha do cliente', async () => {
    expect(await statusAcesso(f.db, CLIENTE_A, '529.982.247-25')).toMatchObject({ disponivel: true, liberado: false, documentoValido: true, sessoesAtivas: 0 })
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    await criarSessao(f.db, CLIENTE_A)
    expect(await statusAcesso(f.db, CLIENTE_A, '529.982.247-25')).toMatchObject({ liberado: true, emailAcesso: 'a@x.com', sessoesAtivas: 1 })
    expect((await statusAcesso(f.db, CLIENTE_A, '123')).documentoValido).toBe(false)
  })

  it('status com a migração ausente → disponivel:false (a ficha do cliente não quebra)', async () => {
    f.falharTabela('portal_acessos', '42P01')
    expect((await statusAcesso(f.db, CLIENTE_A, null)).disponivel).toBe(false)
  })

  it('chave "mostrar horas": padrão ligada; sócio desliga e liga; sem acesso liberado → 409', async () => {
    expect(await definirMostrarHoras(f.db, CLIENTE_A, false, SOCIO)).toMatchObject({ ok: false, status: 409 })
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    expect((await statusAcesso(f.db, CLIENTE_A, '529.982.247-25')).mostrarHoras).toBe(true)
    expect(await definirMostrarHoras(f.db, CLIENTE_A, false, SOCIO)).toEqual({ ok: true })
    expect(f.tabelas.portal_acessos[0].mostrar_horas).toBe(false)
    expect((await statusAcesso(f.db, CLIENTE_A, '529.982.247-25')).mostrarHoras).toBe(false)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('horas_visibilidade')
    await definirMostrarHoras(f.db, CLIENTE_A, true, SOCIO)
    expect((await statusAcesso(f.db, CLIENTE_A, '529.982.247-25')).mostrarHoras).toBe(true)
  })

  it('religar o acesso (liberar de novo) não mexe na chave das horas', async () => {
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    await definirMostrarHoras(f.db, CLIENTE_A, false, SOCIO)
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'novo@x.com', usuarioId: SOCIO, enviarCodigo: false })
    expect(f.tabelas.portal_acessos[0].mostrar_horas).toBe(false)
  })
})
