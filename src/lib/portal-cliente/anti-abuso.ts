// Anti-abuso do portal, TUDO NO BANCO (tabela portal_tentativas, janela deslizante).
// Não depende de Upstash. A chave guardada é um HMAC do documento/IP/e-mail, nunca o valor em claro.

import type { Db } from './db'
import { checar } from './db'
import { hmac } from './segredos'
import { logSecurity } from '@/lib/portal/logger'

const HORA = 60 * 60 * 1000

export interface Limite {
  /** Tipo da tentativa (ex.: 'solicitar_doc'). */
  tipo: string
  /** Valor a limitar (documento, IP, e-mail, id). null/vazio = não limita este eixo. */
  valor: string | null | undefined
  max: number
  janelaMs: number
}

/** Limites padrão (por janela deslizante). Exceder bloqueia temporariamente, até a janela "andar". */
export const LIMITES = {
  solicitarPorDocumento: (doc: string): Limite => ({ tipo: 'solicitar_doc', valor: doc, max: 5, janelaMs: HORA }),
  solicitarPorIp: (ip: string | null): Limite => ({ tipo: 'solicitar_ip', valor: ip, max: 20, janelaMs: HORA }),
  verificarPorDocumento: (doc: string): Limite => ({ tipo: 'verificar_doc', valor: doc, max: 15, janelaMs: HORA }),
  verificarPorIp: (ip: string | null): Limite => ({ tipo: 'verificar_ip', valor: ip, max: 40, janelaMs: HORA }),
  pedidoPorIp: (ip: string | null): Limite => ({ tipo: 'pedido_ip', valor: ip, max: 5, janelaMs: HORA }),
  pedidoPorDocumento: (doc: string): Limite => ({ tipo: 'pedido_doc', valor: doc, max: 3, janelaMs: HORA }),
  pedidoPorEmail: (email: string): Limite => ({ tipo: 'pedido_email', valor: email.toLowerCase(), max: 3, janelaMs: HORA }),
  pedidoGlobal: (): Limite => ({ tipo: 'pedido_global', valor: 'todos', max: 40, janelaMs: HORA }),
  envioPorCliente: (clienteId: string): Limite => ({ tipo: 'envio_doc', valor: clienteId, max: 30, janelaMs: HORA }),
  relatorioPorCliente: (clienteId: string): Limite => ({ tipo: 'relatorio', valor: clienteId, max: 10, janelaMs: HORA }),
} as const

export function chaveDaTentativa(tipo: string, valor: string): string {
  return hmac(`tentativa:${tipo}`, valor).slice(0, 40)
}

async function contar(db: Db, tipo: string, chave: string, desde: Date): Promise<number> {
  const { count, error } = await db
    .from('portal_tentativas')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', tipo)
    .eq('chave', chave)
    .gte('criado_em', desde.toISOString())
  checar(error, 'tentativas')
  return count ?? 0
}

export type ResultadoLimite = { ok: true } | { ok: false; tipo: string }

/**
 * Confere todos os limites; se algum estourou, bloqueia (sem registrar mais nada). Se todos passam,
 * registra uma tentativa em cada eixo. Conta TODA solicitação, exista ou não o documento, para o
 * bloqueio não revelar nada.
 */
export async function aplicarLimites(db: Db, limites: Limite[], agora: Date = new Date()): Promise<ResultadoLimite> {
  const ativos = limites.filter(l => !!l.valor)
  for (const l of ativos) {
    const chave = chaveDaTentativa(l.tipo, l.valor as string)
    const n = await contar(db, l.tipo, chave, new Date(agora.getTime() - l.janelaMs))
    if (n >= l.max) {
      logSecurity({ type: 'rate_limit', endpoint: 'portal', detail: l.tipo })
      return { ok: false, tipo: l.tipo }
    }
  }
  if (ativos.length) {
    const { error } = await db.from('portal_tentativas').insert(
      ativos.map(l => ({ tipo: l.tipo, chave: chaveDaTentativa(l.tipo, l.valor as string), criado_em: agora.toISOString() })),
    )
    checar(error, 'tentativas')
  }
  return { ok: true }
}

/** Limpeza oportunista (1 em 20 chamadas): apaga o que já saiu de qualquer janela. */
export async function limpezaOportunista(db: Db, agora: Date = new Date(), sorteio: number = Math.random()): Promise<void> {
  if (sorteio > 0.05) return
  const corte = new Date(agora.getTime() - 2 * 24 * HORA).toISOString()
  await db.from('portal_tentativas').delete().lt('criado_em', corte)
  await db.from('portal_codigos').delete().lt('criado_em', corte)
  await db.from('portal_sessoes').delete().lt('expira_em', corte)
}
