// Código de acesso de 6 dígitos: gerar, emitir (só o hash vai ao banco) e conferir
// (comparação em tempo constante, uso único, no máximo 5 tentativas por código).

import { randomInt } from 'node:crypto'
import type { Db } from './db'
import { checar } from './db'
import { hmac, iguaisEmTempoConstante } from './segredos'
import { CODIGO_MAX_TENTATIVAS, CODIGO_VALIDADE_MS } from './constantes'

export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function codigoComFormatoValido(codigo: unknown): codigo is string {
  return typeof codigo === 'string' && /^\d{6}$/.test(codigo)
}

/** HMAC com o cliente no contexto: o mesmo código de dois clientes gera hashes diferentes. */
export function hashCodigo(clienteId: string, codigo: string): string {
  return hmac(`codigo:${clienteId}`, codigo)
}

/** Gera um código novo para o cliente, invalida os anteriores ainda abertos e devolve o código em claro (para o e-mail). */
export async function emitirCodigo(db: Db, clienteId: string, agora: Date = new Date()): Promise<string> {
  const { error: e1 } = await db
    .from('portal_codigos')
    .update({ invalidado_em: agora.toISOString() })
    .eq('cliente_id', clienteId)
    .is('usado_em', null)
    .is('invalidado_em', null)
  checar(e1, 'codigos')

  const codigo = gerarCodigo()
  const { error: e2 } = await db.from('portal_codigos').insert({
    cliente_id: clienteId,
    codigo_hash: hashCodigo(clienteId, codigo),
    tentativas: 0,
    expira_em: new Date(agora.getTime() + CODIGO_VALIDADE_MS).toISOString(),
    criado_em: agora.toISOString(),
  })
  checar(e2, 'codigos')
  return codigo
}

interface LinhaCodigo { id: string; codigo_hash: string; tentativas: number; expira_em: string }

/**
 * Confere o código digitado. Devolve true só se for o código vigente do cliente, dentro da validade,
 * com tentativas disponíveis, e ele for consumido neste instante (uso único, atômico).
 *
 * A tentativa é contada ANTES da comparação (compare-and-set), de modo que requisições paralelas não
 * conseguem passar de CODIGO_MAX_TENTATIVAS comparações no total.
 */
export async function conferirCodigo(db: Db, clienteId: string, digitado: string, agora: Date = new Date()): Promise<boolean> {
  for (let rodada = 0; rodada < 8; rodada++) {
    const { data, error } = await db
      .from('portal_codigos')
      .select('id, codigo_hash, tentativas, expira_em')
      .eq('cliente_id', clienteId)
      .is('usado_em', null)
      .is('invalidado_em', null)
      .order('criado_em', { ascending: false })
      .limit(1)
    checar(error, 'codigos')
    const linha = (data as LinhaCodigo[] | null)?.[0]
    if (!linha) return false
    if (new Date(linha.expira_em).getTime() <= agora.getTime()) return false

    if (linha.tentativas >= CODIGO_MAX_TENTATIVAS) {
      await db.from('portal_codigos').update({ invalidado_em: agora.toISOString() }).eq('id', linha.id).is('invalidado_em', null)
      return false
    }

    // Conta a tentativa (só uma requisição vence cada valor de "tentativas").
    const { data: contou, error: e2 } = await db
      .from('portal_codigos')
      .update({ tentativas: linha.tentativas + 1 })
      .eq('id', linha.id)
      .eq('tentativas', linha.tentativas)
      .is('usado_em', null)
      .is('invalidado_em', null)
      .select('id')
    checar(e2, 'codigos')
    if (!contou || contou.length === 0) continue // outra requisição contou antes; relê

    const confere = iguaisEmTempoConstante(linha.codigo_hash, hashCodigo(clienteId, digitado))
    if (!confere) {
      if (linha.tentativas + 1 >= CODIGO_MAX_TENTATIVAS) {
        await db.from('portal_codigos').update({ invalidado_em: agora.toISOString() }).eq('id', linha.id).is('invalidado_em', null)
      }
      return false
    }

    // Consome (uso único): só quem marcar usado_em primeiro vence.
    const { data: usou, error: e3 } = await db
      .from('portal_codigos')
      .update({ usado_em: agora.toISOString() })
      .eq('id', linha.id)
      .is('usado_em', null)
      .is('invalidado_em', null)
      .select('id')
    checar(e3, 'codigos')
    return !!usou && usou.length > 0
  }
  return false
}

/** Invalida todos os códigos abertos do cliente (depois de um login bem-sucedido ou de uma revogação). */
export async function invalidarCodigosDoCliente(db: Db, clienteId: string, agora: Date = new Date()): Promise<void> {
  await db
    .from('portal_codigos')
    .update({ invalidado_em: agora.toISOString() })
    .eq('cliente_id', clienteId)
    .is('usado_em', null)
    .is('invalidado_em', null)
}
