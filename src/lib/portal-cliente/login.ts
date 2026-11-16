// Fluxo de login do portal (CPF/CNPJ + código). MODO PILOTO: só recebe código quem tem liberação ATIVA em
// portal_acessos (feita à mão por um sócio, com o e-mail de acesso que o sócio informou). O e-mail do cadastro
// (clientes.email) NÃO é usado para enviar código. E-mail digitado pelo cliente nunca recebe código.

import type { Db } from './db'
import { checar } from './db'
import { emitirCodigo, conferirCodigo, invalidarCodigosDoCliente, hashCodigo } from './codigo'
import { criarSessao } from './sessao'
import { registrarLogPortal } from './log'
import { somenteDigitos } from './documento'
import { emailValido } from '@/lib/email/mailer'

interface ClienteDoc { id: string; nome: string; ativo: boolean | null; cpf_cnpj: string | null }

/** Clientes cujo documento (ignorando pontuação) é exatamente este. O cadastro guarda o documento com ou sem máscara. */
export async function buscarClientesPorDocumento(db: Db, digitos: string): Promise<ClienteDoc[]> {
  const padrao = `%${digitos.split('').join('%')}%`
  const { data, error } = await db.from('clientes').select('id, nome, ativo, cpf_cnpj').ilike('cpf_cnpj', padrao).limit(50)
  checar(error, 'clientes')
  return ((data ?? []) as ClienteDoc[]).filter(c => somenteDigitos(c.cpf_cnpj ?? '') === digitos)
}

export type Resolucao =
  | { status: 'ok'; clienteId: string; clienteNome: string; emailAcesso: string }
  | { status: 'nenhum' | 'ambiguo' | 'sem_liberacao' | 'inativo' }

/**
 * Descobre, a partir do documento, quem pode receber código. Só `ok` envia algo.
 * Regra: exatamente UM cliente com este documento tem liberação ativa em portal_acessos, está ativo
 * e a liberação tem e-mail de acesso válido. Documento duplicado sem liberação única = ambíguo = nada é enviado.
 */
export async function resolverAcessoPorDocumento(db: Db, digitos: string): Promise<Resolucao> {
  const clientes = await buscarClientesPorDocumento(db, digitos)
  if (clientes.length === 0) return { status: 'nenhum' }

  const { data, error } = await db
    .from('portal_acessos')
    .select('cliente_id, email_acesso, ativo')
    .in('cliente_id', clientes.map(c => c.id))
    .eq('ativo', true)
  checar(error, 'acessos')
  const liberacoes = (data ?? []) as { cliente_id: string; email_acesso: string | null }[]
  if (liberacoes.length === 0) return { status: 'sem_liberacao' }
  if (liberacoes.length > 1) return { status: 'ambiguo' }

  const lib = liberacoes[0]
  const cliente = clientes.find(c => c.id === lib.cliente_id)
  if (!cliente || cliente.ativo === false) return { status: 'inativo' }
  const email = (lib.email_acesso ?? '').trim().toLowerCase()
  if (!email || !emailValido(email)) return { status: 'sem_liberacao' }
  return { status: 'ok', clienteId: cliente.id, clienteNome: cliente.nome, emailAcesso: email }
}

/**
 * Pedido de código. Devolve o que deve ser enviado (ou null). Quem chama decide o envio (em segundo plano)
 * e NUNCA conta ao cliente o resultado.
 */
export async function prepararCodigo(db: Db, digitos: string, agora: Date = new Date()): Promise<{ para: string; codigo: string; clienteId: string } | null> {
  const r = await resolverAcessoPorDocumento(db, digitos)
  if (r.status !== 'ok') return null
  const codigo = await emitirCodigo(db, r.clienteId, agora)
  return { para: r.emailAcesso, codigo, clienteId: r.clienteId }
}

/** Confere documento + código. Em caso de falha por qualquer motivo, mesma saída (false). */
export async function verificarCodigo(db: Db, digitos: string, codigo: string, agora: Date = new Date()): Promise<{ clienteId: string } | null> {
  const r = await resolverAcessoPorDocumento(db, digitos)
  if (r.status !== 'ok') {
    hashCodigo('00000000-0000-0000-0000-000000000000', codigo) // gasta um tempo parecido
    return null
  }
  const confere = await conferirCodigo(db, r.clienteId, codigo, agora)
  return confere ? { clienteId: r.clienteId } : null
}

/** Cria a sessão, marca último acesso, invalida outros códigos abertos e registra no log. */
export async function concluirLogin(
  db: Db,
  clienteId: string,
  contexto: { ip?: string | null; userAgent?: string | null },
  agora: Date = new Date(),
): Promise<{ token: string; expiraEm: Date }> {
  const sessao = await criarSessao(db, clienteId, contexto, agora)
  await db.from('portal_acessos').update({ ultimo_acesso: agora.toISOString() }).eq('cliente_id', clienteId)
  await invalidarCodigosDoCliente(db, clienteId, agora)
  await registrarLogPortal(db, { acao: 'login', clienteId })
  return sessao
}
