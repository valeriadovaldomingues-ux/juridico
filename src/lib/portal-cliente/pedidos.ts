// Pedido de primeiro acesso: o cliente informa documento + dados de conferência e cai numa fila para um SÓ humano
// do escritório decidir. Nada é enviado ao e-mail digitado. Os dados de conferência (nascimento, mãe, pai) são
// APAGADOS quando o pedido é aprovado ou rejeitado (minimização LGPD).

import type { Db } from './db'
import { checar } from './db'
import { normalizarDocumento, somenteDigitos } from './documento'
import { emailValido } from '@/lib/email/mailer'

export interface DadosPedido {
  documento: string
  nascimento: string // ISO yyyy-mm-dd
  nomeMae: string
  nomePai: string | null
  email: string
  telefone: string | null
}

export type ValidacaoPedido = { ok: true; dados: DadosPedido } | { ok: false; erro: string }

/** Aceita "dd/mm/aaaa" ou "aaaa-mm-dd"; devolve ISO ou null se não for uma data real e plausível. */
export function parseNascimento(valor: unknown, agora: Date = new Date()): string | null {
  if (typeof valor !== 'string') return null
  const v = valor.trim()
  let a: number, m: number, d: number
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (br) { d = +br[1]; m = +br[2]; a = +br[3] } else if (iso) { a = +iso[1]; m = +iso[2]; d = +iso[3] } else return null
  const data = new Date(Date.UTC(a, m - 1, d))
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null
  if (a < 1900 || data.getTime() > agora.getTime()) return null
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function nomeLimpo(valor: unknown, min: number, max = 120): string | null {
  if (typeof valor !== 'string') return null
  const v = valor.replace(/\s+/g, ' ').trim()
  return v.length >= min && v.length <= max ? v : null
}

export function validarPedido(corpo: Record<string, unknown>, agora: Date = new Date()): ValidacaoPedido {
  const doc = normalizarDocumento(corpo.documento)
  if (!doc.ok) return { ok: false, erro: 'Confira o CPF ou CNPJ digitado.' }
  const nascimento = parseNascimento(corpo.nascimento, agora)
  if (!nascimento) return { ok: false, erro: 'Informe a data de nascimento no formato dd/mm/aaaa.' }
  const nomeMae = nomeLimpo(corpo.nome_mae, 3)
  if (!nomeMae) return { ok: false, erro: 'Informe o nome completo da mãe.' }
  const nomePai = corpo.nome_pai === undefined || corpo.nome_pai === null || corpo.nome_pai === '' ? null : nomeLimpo(corpo.nome_pai, 3)
  if (corpo.nome_pai && !nomePai) return { ok: false, erro: 'Confira o nome do pai.' }
  const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : ''
  if (!email || email.length > 160 || !emailValido(email)) return { ok: false, erro: 'Informe um e-mail válido.' }
  let telefone: string | null = null
  if (corpo.telefone !== undefined && corpo.telefone !== null && corpo.telefone !== '') {
    const t = typeof corpo.telefone === 'string' ? somenteDigitos(corpo.telefone) : ''
    if (t.length < 8 || t.length > 13) return { ok: false, erro: 'Confira o telefone.' }
    telefone = t
  }
  return { ok: true, dados: { documento: doc.digitos, nascimento, nomeMae, nomePai, email, telefone } }
}

/**
 * Grava o pedido pendente. Evita duplicar: se já há um pendente do mesmo documento + e-mail nas últimas 24 h,
 * não cria outro. Devolve true se criou.
 */
export async function criarPedido(db: Db, d: DadosPedido, ipResumo: string | null, agora: Date = new Date()): Promise<{ criado: boolean; id: string | null }> {
  const desde = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: iguais, error: e1 } = await db
    .from('portal_pedidos_acesso')
    .select('id')
    .eq('documento', d.documento)
    .eq('email', d.email)
    .eq('status', 'pendente')
    .gte('criado_em', desde)
    .limit(1)
  checar(e1, 'pedidos')
  if (iguais && iguais.length > 0) return { criado: false, id: null }

  const { data, error } = await db
    .from('portal_pedidos_acesso')
    .insert({
      documento: d.documento,
      email: d.email,
      telefone: d.telefone,
      nascimento: d.nascimento,
      nome_mae: d.nomeMae,
      nome_pai: d.nomePai,
      status: 'pendente',
      ip_resumo: ipResumo,
      criado_em: agora.toISOString(),
    })
    .select('id')
  checar(error, 'pedidos')
  return { criado: true, id: (data?.[0]?.id as string | undefined) ?? null }
}

/** Já houve outro pedido nos últimos 30 min? (para não mandar um e-mail por pedido aos sócios). */
export async function houvePedidoRecente(db: Db, ateIdExclusive: string | null, agora: Date = new Date()): Promise<boolean> {
  const desde = new Date(agora.getTime() - 30 * 60 * 1000).toISOString()
  const { data } = await db.from('portal_pedidos_acesso').select('id').gte('criado_em', desde).limit(3)
  return (data ?? []).some(p => p.id !== ateIdExclusive)
}
