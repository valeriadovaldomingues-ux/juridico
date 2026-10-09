// Relatório de horas por cliente — só HORAS (nunca valores em R$): é o que a equipe toda
// pode emitir e entregar ao cliente. Os valores (valor/hora, total) ficam restritos aos sócios
// e não passam por aqui.

import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateEffectiveMinutes } from '@/lib/agenda-time-entries'

export interface LinhaHoras {
  id: string
  inicioEm: string
  data: string            // dd/mm/aaaa (Brasília)
  processo: string | null // nº do processo
  atividade: string
  responsavel: string
  minutos: number
}

export interface RelatorioHoras {
  cliente: string
  de: string              // YYYY-MM-DD
  ate: string             // YYYY-MM-DD
  linhas: LinhaHoras[]
  totalMinutos: number
  porResponsavel: { nome: string; minutos: number }[]
}

const FUSO = 'America/Sao_Paulo'

export function dataBR(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

export function dataValida(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime())
}

/** Total por pessoa, do maior para o menor. */
export function totaisPorResponsavel(linhas: Pick<LinhaHoras, 'responsavel' | 'minutos'>[]) {
  const mapa = new Map<string, number>()
  for (const l of linhas) mapa.set(l.responsavel, (mapa.get(l.responsavel) ?? 0) + l.minutos)
  return [...mapa.entries()].map(([nome, minutos]) => ({ nome, minutos })).sort((a, b) => b.minutos - a.minutos)
}

type EntradaBanco = {
  id: string
  inicio_em: string
  duracao_calculada_minutos: number | null
  duracao_manual_minutos: number | null
  usa_duracao_manual: boolean
  status_cobranca: string
  descricao_atividade: string | null
  criado_por: string | null
  processo: { numero_processo: string | null } | { numero_processo: string | null }[] | null
  agenda_item: { titulo: string | null } | { titulo: string | null }[] | null
}

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

/**
 * Lança as horas COBRÁVEIS do cliente no período (data do início do trabalho, horário de Brasília).
 * Não seleciona nenhuma coluna de valor.
 */
export async function buscarHoras(
  supabase: SupabaseClient,
  p: { clienteId: string; de: string; ate: string },
): Promise<RelatorioHoras> {
  const { data: cliente } = await supabase.from('clientes').select('nome').eq('id', p.clienteId).maybeSingle()

  const entradas: EntradaBanco[] = []
  for (let de = 0; ; de += 1000) {
    const { data } = await supabase
      .from('agenda_time_entries')
      .select('id, inicio_em, duracao_calculada_minutos, duracao_manual_minutos, usa_duracao_manual, status_cobranca, descricao_atividade, criado_por, processo:processos(numero_processo), agenda_item:agenda_items(titulo)')
      .eq('cliente_id', p.clienteId)
      .eq('cobravel', true)
      .neq('status_cobranca', 'nao_faturavel')
      .gte('inicio_em', `${p.de}T00:00:00-03:00`)
      .lte('inicio_em', `${p.ate}T23:59:59.999-03:00`)
      .order('inicio_em', { ascending: true })
      .order('id', { ascending: true })
      .range(de, de + 999)
    entradas.push(...((data ?? []) as unknown as EntradaBanco[]))
    if (!data || data.length < 1000) break
  }

  const { data: equipe } = await supabase.rpc('perfis_equipe')
  const nomes = new Map(((equipe ?? []) as { id: string; nome: string }[]).map(e => [e.id, e.nome]))

  const linhas: LinhaHoras[] = entradas
    .map(e => ({
      id: e.id,
      inicioEm: e.inicio_em,
      data: dataBR(e.inicio_em),
      processo: um(e.processo)?.numero_processo ?? null,
      atividade: (e.descricao_atividade?.trim() || um(e.agenda_item)?.titulo?.trim() || 'Atividade'),
      responsavel: (e.criado_por && nomes.get(e.criado_por)) || '—',
      minutos: calculateEffectiveMinutes(e) ?? 0,
    }))
    .filter(l => l.minutos > 0)

  return {
    cliente: cliente?.nome ?? 'Cliente',
    de: p.de,
    ate: p.ate,
    linhas,
    totalMinutos: linhas.reduce((s, l) => s + l.minutos, 0),
    porResponsavel: totaisPorResponsavel(linhas),
  }
}
