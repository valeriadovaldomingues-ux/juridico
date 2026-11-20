// Gestão do portal pelo escritório (só sócio, por enquanto — ver PORTAL_PAPEIS_GESTAO): fila de pedidos,
// liberar, revogar, encerrar sessões. Roda só no servidor, com service_role, DEPOIS do guard de papel.

import type { Db } from './db'
import { checar, tabelaAusente } from './db'
import { buscarClientesPorDocumento } from './login'
import { emitirCodigo, invalidarCodigosDoCliente } from './codigo'
import { revogarSessoesDoCliente } from './sessao'
import { registrarLogPortal } from './log'
import { cnpjValido, cpfValido, somenteDigitos } from './documento'
import { emailValido } from '@/lib/email/mailer'

// ── Pedidos ──────────────────────────────────────────────────────────────────

export interface CandidatoPedido {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  /** Conferência da data de nascimento sem revelar o valor guardado. */
  nascimento: 'confere' | 'nao_confere' | 'sem_dado'
  liberado: boolean
}

export interface PedidoNaFila {
  id: string
  documento: string
  email: string
  telefone: string | null
  nascimentoInformado: string | null
  nomeMae: string | null
  nomePai: string | null
  criadoEm: string
  candidatos: CandidatoPedido[]
}

export async function listarPedidosPendentes(db: Db): Promise<PedidoNaFila[]> {
  const { data, error } = await db
    .from('portal_pedidos_acesso')
    .select('id, documento, email, telefone, nascimento, nome_mae, nome_pai, criado_em')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true })
    .limit(200)
  checar(error, 'pedidos')
  const pedidos = data ?? []
  const saida: PedidoNaFila[] = []
  for (const p of pedidos) {
    const achados = await buscarClientesPorDocumento(db, p.documento as string)
    let candidatos: CandidatoPedido[] = []
    if (achados.length) {
      const ids = achados.map(c => c.id)
      const { data: det } = await db.from('clientes').select('id, nome, email, telefone, celular, data_nascimento').in('id', ids)
      const { data: lib } = await db.from('portal_acessos').select('cliente_id').in('cliente_id', ids).eq('ativo', true)
      const liberados = new Set((lib ?? []).map(l => l.cliente_id as string))
      candidatos = (det ?? []).map(c => {
        const guardado = (c.data_nascimento as string | null)?.slice(0, 10) ?? null
        const informado = (p.nascimento as string | null)?.slice(0, 10) ?? null
        return {
          id: c.id as string,
          nome: c.nome as string,
          email: (c.email as string | null) ?? null,
          telefone: ((c.celular as string | null) || (c.telefone as string | null)) ?? null,
          nascimento: !guardado ? 'sem_dado' : guardado === informado ? 'confere' : 'nao_confere',
          liberado: liberados.has(c.id as string),
        }
      })
    }
    saida.push({
      id: p.id as string,
      documento: p.documento as string,
      email: p.email as string,
      telefone: (p.telefone as string | null) ?? null,
      nascimentoInformado: (p.nascimento as string | null) ?? null,
      nomeMae: (p.nome_mae as string | null) ?? null,
      nomePai: (p.nome_pai as string | null) ?? null,
      criadoEm: p.criado_em as string,
      candidatos,
    })
  }
  return saida
}

export async function contarPedidosPendentes(db: Db): Promise<number | null> {
  const { count, error } = await db.from('portal_pedidos_acesso').select('id', { count: 'exact', head: true }).eq('status', 'pendente')
  if (error) return tabelaAusente(error) ? null : 0
  return count ?? 0
}

export type ResultadoDecisao =
  | { ok: true; codigoParaEnviar?: { para: string; codigo: string } }
  | { ok: false; erro: string; status: number }

const SEM_DADOS_DE_CONFERENCIA = { nascimento: null, nome_mae: null, nome_pai: null }

export async function decidirPedido(
  db: Db,
  entrada: {
    pedidoId: string
    usuarioId: string
    acao: 'aprovar' | 'rejeitar'
    clienteId?: string
    emailAcesso?: string
    confirmadoComCliente?: boolean
  },
  agora: Date = new Date(),
): Promise<ResultadoDecisao> {
  const { data: pedido, error } = await db
    .from('portal_pedidos_acesso')
    .select('id, documento, email, status')
    .eq('id', entrada.pedidoId)
    .maybeSingle()
  checar(error, 'pedidos')
  if (!pedido) return { ok: false, erro: 'Pedido não encontrado.', status: 404 }
  if (pedido.status !== 'pendente') return { ok: false, erro: 'Este pedido já foi decidido.', status: 409 }

  if (entrada.acao === 'rejeitar') {
    const { data: r, error: e } = await db
      .from('portal_pedidos_acesso')
      .update({ status: 'rejeitado', decidido_por: entrada.usuarioId, decidido_em: agora.toISOString(), ...SEM_DADOS_DE_CONFERENCIA })
      .eq('id', entrada.pedidoId)
      .eq('status', 'pendente')
      .select('id')
    checar(e, 'pedidos')
    if (!r?.length) return { ok: false, erro: 'Este pedido já foi decidido.', status: 409 }
    await registrarLogPortal(db, { acao: 'pedido_rejeitado', pedidoId: entrada.pedidoId, usuarioId: entrada.usuarioId })
    return { ok: true }
  }

  // aprovar
  if (!entrada.confirmadoComCliente) {
    return { ok: false, erro: 'Confirme com o cliente por telefone ou WhatsApp antes de aprovar.', status: 400 }
  }
  if (!entrada.clienteId) return { ok: false, erro: 'Escolha o cliente.', status: 400 }
  const email = (entrada.emailAcesso ?? (pedido.email as string)).trim().toLowerCase()
  if (!emailValido(email)) return { ok: false, erro: 'E-mail de acesso inválido.', status: 400 }

  const candidatos = await buscarClientesPorDocumento(db, pedido.documento as string)
  const cliente = candidatos.find(c => c.id === entrada.clienteId)
  if (!cliente) return { ok: false, erro: 'O cliente escolhido não tem o documento deste pedido.', status: 400 }
  if (cliente.ativo === false) return { ok: false, erro: 'Cliente inativo.', status: 400 }

  // 1) reserva a decisão (impede decisão dupla); 2) libera; 3) só então apaga os dados de conferência.
  const { data: reservou, error: e1 } = await db
    .from('portal_pedidos_acesso')
    .update({ status: 'aprovado', cliente_id: cliente.id, decidido_por: entrada.usuarioId, decidido_em: agora.toISOString() })
    .eq('id', entrada.pedidoId)
    .eq('status', 'pendente')
    .select('id')
  checar(e1, 'pedidos')
  if (!reservou?.length) return { ok: false, erro: 'Este pedido já foi decidido.', status: 409 }

  try {
    await gravarLiberacao(db, cliente.id, email, entrada.usuarioId, agora)
  } catch (e) {
    await db.from('portal_pedidos_acesso').update({ status: 'pendente', cliente_id: null, decidido_por: null, decidido_em: null }).eq('id', entrada.pedidoId)
    throw e
  }
  await db.from('portal_pedidos_acesso').update(SEM_DADOS_DE_CONFERENCIA).eq('id', entrada.pedidoId)

  const codigo = await emitirCodigo(db, cliente.id, agora)
  await registrarLogPortal(db, { acao: 'pedido_aprovado', clienteId: cliente.id, pedidoId: entrada.pedidoId, usuarioId: entrada.usuarioId })
  return { ok: true, codigoParaEnviar: { para: email, codigo } }
}

// ── Liberação, revogação, sessões ───────────────────────────────────────────

async function gravarLiberacao(db: Db, clienteId: string, email: string, usuarioId: string, agora: Date): Promise<void> {
  const { data: existente, error } = await db.from('portal_acessos').select('id').eq('cliente_id', clienteId).maybeSingle()
  checar(error, 'acessos')
  const campos = {
    email_acesso: email,
    ativo: true,
    aprovado_por: usuarioId,
    aprovado_em: agora.toISOString(),
    revogado_em: null,
    updated_at: agora.toISOString(),
  }
  if (existente) {
    const { error: e } = await db.from('portal_acessos').update(campos).eq('id', existente.id as string)
    checar(e, 'acessos')
  } else {
    const { error: e } = await db.from('portal_acessos').insert({ cliente_id: clienteId, ...campos })
    checar(e, 'acessos')
  }
}

/** Libera (ou re-libera) um cliente pelo sócio, com o e-mail de acesso informado por ele. */
export async function liberarAcesso(
  db: Db,
  entrada: { clienteId: string; emailAcesso: string; usuarioId: string; enviarCodigo: boolean },
  agora: Date = new Date(),
): Promise<ResultadoDecisao> {
  const email = entrada.emailAcesso.trim().toLowerCase()
  if (!emailValido(email)) return { ok: false, erro: 'Informe um e-mail de acesso válido.', status: 400 }
  const { data: cliente, error } = await db.from('clientes').select('id, ativo, cpf_cnpj').eq('id', entrada.clienteId).maybeSingle()
  checar(error, 'clientes')
  if (!cliente) return { ok: false, erro: 'Cliente não encontrado.', status: 404 }
  if (cliente.ativo === false) return { ok: false, erro: 'Cliente inativo.', status: 400 }
  const d = somenteDigitos((cliente.cpf_cnpj as string | null) ?? '')
  if (!(cpfValido(d) || cnpjValido(d))) {
    return { ok: false, erro: 'Este cliente não tem CPF/CNPJ válido no cadastro; sem ele não consegue entrar. Corrija o cadastro primeiro.', status: 400 }
  }
  const duplicados = await buscarClientesPorDocumento(db, d)
  if (duplicados.length > 1) {
    const { data: lib } = await db.from('portal_acessos').select('cliente_id').in('cliente_id', duplicados.map(c => c.id)).eq('ativo', true)
    const outros = (lib ?? []).filter(l => l.cliente_id !== entrada.clienteId)
    if (outros.length) return { ok: false, erro: 'Outro cadastro com o mesmo CPF/CNPJ já está liberado. Resolva a duplicidade antes.', status: 409 }
  }
  await gravarLiberacao(db, entrada.clienteId, email, entrada.usuarioId, agora)
  await registrarLogPortal(db, { acao: 'acesso_liberado', clienteId: entrada.clienteId, usuarioId: entrada.usuarioId })
  if (!entrada.enviarCodigo) return { ok: true }
  const codigo = await emitirCodigo(db, entrada.clienteId, agora)
  return { ok: true, codigoParaEnviar: { para: email, codigo } }
}

export async function revogarAcesso(db: Db, clienteId: string, usuarioId: string, agora: Date = new Date()): Promise<{ sessoesEncerradas: number }> {
  const { data: existente, error } = await db.from('portal_acessos').select('id').eq('cliente_id', clienteId).maybeSingle()
  checar(error, 'acessos')
  const campos = { ativo: false, revogado_em: agora.toISOString(), updated_at: agora.toISOString() }
  if (existente) {
    const { error: e } = await db.from('portal_acessos').update(campos).eq('id', existente.id as string)
    checar(e, 'acessos')
  } else {
    const { error: e } = await db.from('portal_acessos').insert({ cliente_id: clienteId, email_acesso: null, ...campos })
    checar(e, 'acessos')
  }
  const sessoesEncerradas = await revogarSessoesDoCliente(db, clienteId, agora)
  await invalidarCodigosDoCliente(db, clienteId, agora)
  await registrarLogPortal(db, { acao: 'acesso_revogado', clienteId, usuarioId, detalhes: { sessoes: sessoesEncerradas } })
  return { sessoesEncerradas }
}

/** Liga/desliga a aba Horas no portal de UM cliente (só quem já tem linha em portal_acessos). */
export async function definirMostrarHoras(
  db: Db,
  clienteId: string,
  mostrar: boolean,
  usuarioId: string,
  agora: Date = new Date(),
): Promise<ResultadoDecisao> {
  const { data: existente, error } = await db.from('portal_acessos').select('id').eq('cliente_id', clienteId).maybeSingle()
  checar(error, 'acessos')
  if (!existente) return { ok: false, erro: 'Libere o acesso deste cliente ao portal antes de ajustar o que ele vê.', status: 409 }
  const { error: e } = await db.from('portal_acessos').update({ mostrar_horas: mostrar, updated_at: agora.toISOString() }).eq('id', existente.id as string)
  checar(e, 'acessos')
  await registrarLogPortal(db, { acao: 'horas_visibilidade', clienteId, usuarioId, detalhes: { mostrar } })
  return { ok: true }
}

export async function encerrarSessoes(db: Db, clienteId: string, usuarioId: string, agora: Date = new Date()): Promise<{ sessoesEncerradas: number }> {
  const sessoesEncerradas = await revogarSessoesDoCliente(db, clienteId, agora)
  await registrarLogPortal(db, { acao: 'sessoes_encerradas', clienteId, usuarioId, detalhes: { sessoes: sessoesEncerradas } })
  return { sessoesEncerradas }
}

// ── Status para a ficha do cliente ───────────────────────────────────────────

export interface StatusAcessoPortal {
  /** false = migração ainda não aplicada. */
  disponivel: boolean
  liberado: boolean
  emailAcesso: string | null
  aprovadoEm: string | null
  ultimoAcesso: string | null
  revogadoEm: string | null
  sessoesAtivas: number
  documentoValido: boolean
  /** Chave "mostrar horas no portal" (padrão: ligada). */
  mostrarHoras: boolean
}

export async function statusAcesso(db: Db, clienteId: string, cpfCnpj: string | null, agora: Date = new Date()): Promise<StatusAcessoPortal> {
  const d = somenteDigitos(cpfCnpj ?? '')
  const base: StatusAcessoPortal = {
    disponivel: true, liberado: false, emailAcesso: null, aprovadoEm: null, ultimoAcesso: null, revogadoEm: null,
    sessoesAtivas: 0, documentoValido: cpfValido(d) || cnpjValido(d), mostrarHoras: true,
  }
  const { data, error } = await db
    .from('portal_acessos')
    .select('email_acesso, ativo, aprovado_em, ultimo_acesso, revogado_em, mostrar_horas')
    .eq('cliente_id', clienteId)
    .maybeSingle()
  if (error) {
    // 42703 = coluna mostrar_horas ainda não existe (migração pendente): lê sem ela e deixa a chave no padrão (ligada).
    if (error.code === '42703') {
      const { data: antigo, error: e2 } = await db
        .from('portal_acessos')
        .select('email_acesso, ativo, aprovado_em, ultimo_acesso, revogado_em')
        .eq('cliente_id', clienteId)
        .maybeSingle()
      if (e2) {
        if (tabelaAusente(e2)) return { ...base, disponivel: false }
        throw new Error('status do acesso ao portal')
      }
      return completarStatus(db, base, antigo, clienteId, agora)
    }
    if (tabelaAusente(error)) return { ...base, disponivel: false }
    throw new Error('status do acesso ao portal')
  }
  return completarStatus(db, base, data, clienteId, agora)
}

async function completarStatus(
  db: Db,
  base: StatusAcessoPortal,
  data: Record<string, unknown> | null,
  clienteId: string,
  agora: Date,
): Promise<StatusAcessoPortal> {
  const { count } = await db
    .from('portal_sessoes')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .is('revogada_em', null)
    .gt('expira_em', agora.toISOString())
  return {
    ...base,
    liberado: data?.ativo === true,
    emailAcesso: (data?.email_acesso as string | null) ?? null,
    aprovadoEm: (data?.aprovado_em as string | null) ?? null,
    ultimoAcesso: (data?.ultimo_acesso as string | null) ?? null,
    revogadoEm: (data?.revogado_em as string | null) ?? null,
    sessoesAtivas: count ?? 0,
    mostrarHoras: data?.mostrar_horas !== false,
  }
}
