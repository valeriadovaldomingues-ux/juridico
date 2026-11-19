// Horas que o cliente vê no portal — só TEMPO (nunca valor/hora nem total em R$: isso é só dos sócios).
// Entram as horas cobráveis do próprio cliente, como no relatório de horas. Não saem: quem lançou, observações
// internas, título da tarefa da agenda nem o nº de processos que o portal não mostra (segredo de justiça / ocultos).

import { calculateEffectiveMinutes } from '@/lib/agenda-time-entries'
import type { Db } from './db'
import { checar } from './db'
import { descricaoParaCliente, processoVisivelNoPortal } from './visibilidade'

export interface HoraPortal {
  id: string
  data: string            // AAAA-MM-DD (Brasília)
  atividade: string
  processoId: string | null
  processoNumero: string | null
  minutos: number
}

const FUSO = 'America/Sao_Paulo'
const dataISOBrasilia = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const lotes = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))

type Linha = {
  id: string
  inicio_em: string
  duracao_calculada_minutos: number | null
  duracao_manual_minutos: number | null
  usa_duracao_manual: boolean
  descricao_atividade: string | null
  processo_id: string | null
}

/** Horas cobráveis do cliente (mais recentes primeiro). `clienteId` vem SEMPRE da sessão do portal. */
export async function listarHoras(db: Db, clienteId: string): Promise<HoraPortal[]> {
  const linhas: Linha[] = []
  for (let pagina = 0; pagina < 20; pagina++) {
    const { data, error } = await db
      .from('agenda_time_entries')
      .select('id, inicio_em, duracao_calculada_minutos, duracao_manual_minutos, usa_duracao_manual, descricao_atividade, processo_id')
      .eq('cliente_id', clienteId)
      .eq('cobravel', true)
      .neq('status_cobranca', 'nao_faturavel')
      .order('inicio_em', { ascending: false })
      .order('id', { ascending: true })
      .range(pagina * 1000, pagina * 1000 + 999)
    checar(error, 'horas')
    const lote = (data ?? []) as unknown as Linha[]
    linhas.push(...lote)
    if (lote.length < 1000) break
  }

  // Número do processo só quando o processo é do cliente e visível no portal.
  const ids = [...new Set(linhas.map(l => l.processo_id).filter((v): v is string => !!v))]
  const visiveis = new Map<string, string | null>()
  for (const grupo of lotes(ids, 80)) {
    const { data, error } = await db
      .from('processos')
      .select('id, numero_processo, segredo_justica, ocultar_portal')
      .eq('cliente_id', clienteId)
      .in('id', grupo)
    checar(error, 'processos')
    for (const p of (data ?? []) as { id: string; numero_processo: string | null; segredo_justica: boolean | null; ocultar_portal: boolean | null }[]) {
      if (processoVisivelNoPortal(p)) visiveis.set(p.id, p.numero_processo)
    }
  }

  return linhas
    .map((l): HoraPortal | null => {
      const minutos = calculateEffectiveMinutes(l) ?? 0
      if (minutos <= 0) return null
      const visivel = !!l.processo_id && visiveis.has(l.processo_id)
      return {
        id: l.id,
        data: dataISOBrasilia(l.inicio_em),
        atividade: descricaoParaCliente(l.descricao_atividade, 300)?.replace(/\n+/g, ' ') ?? 'Atividade jurídica',
        processoId: visivel ? l.processo_id : null,
        processoNumero: visivel ? visiveis.get(l.processo_id as string) ?? null : null,
        minutos,
      }
    })
    .filter((h): h is HoraPortal => !!h)
}

/** Meses (AAAA-MM) que têm horas, do mais recente para o mais antigo. */
export function mesesComHoras(horas: Pick<HoraPortal, 'data'>[]): string[] {
  return [...new Set(horas.map(h => h.data.slice(0, 7)))].sort().reverse()
}

export const mesValido = (m: string | null | undefined): m is string => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)

export const totalMinutos = (horas: Pick<HoraPortal, 'minutos'>[]) => horas.reduce((s, h) => s + h.minutos, 0)
