// ─── Rotina de monitoramento de clientes (por CPF/CNPJ, via DJEN) ───────────
//
// Para cada documento ativo e dentro da vigência: busca no DJEN por cada nome de
// busca, filtra por nome IGUAL, agrupa por processo, compara com `processos` e
// grava UM alerta por processo ainda não cadastrado (upsert idempotente).
//
// Só lê do DJEN e do banco; escreve apenas em monitoramento_alertas e em
// monitoramento_documentos.ultima_busca_em.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  agruparPorProcesso,
  classificarProcessos,
  filtrarComunicacoes,
  montarAlertas,
  soDigitosProcesso,
  type AlertaNovo,
  type ComunicacaoDJEN,
} from './comunicacoes'
import { dataDeTimestamp, hojeSaoPaulo, somarDias } from './datas'
import type { TipoDocumento } from './documento'
import { buscarComunicacoesPorNome, DjenErro, dormir, PAUSA_MS_PADRAO } from './djen'
import { nomesUnicos } from './nomes'

export const JANELA_PADRAO_DIAS = 3
export const BACKFILL_DIAS = 30
export const ORCAMENTO_MS_PADRAO = 240_000 // a rota tem maxDuration = 300s

/** A migração supabase/monitoramento_clientes_migration.sql ainda não foi aplicada. */
export class MigracaoPendenteErro extends Error {
  constructor() {
    super('Tabelas de monitoramento de clientes ainda não existem (aplicar supabase/monitoramento_clientes_migration.sql).')
    this.name = 'MigracaoPendenteErro'
  }
}

/** PGRST205 = tabela fora do schema cache (PostgREST); 42P01 = undefined_table (Postgres). */
export function erroDeTabelaAusente(erro: { code?: string; message?: string } | null | undefined): boolean {
  return !!erro && (erro.code === 'PGRST205' || erro.code === '42P01' || /schema cache|does not exist/i.test(erro.message ?? ''))
}

export interface DocumentoMonitorado {
  id: string
  cliente_id: string | null
  documento: string
  tipo: TipoDocumento
  nome_principal: string
  nomes_busca: string[] | null
  ativo: boolean
  vigencia_inicio: string | null
  vigencia_fim: string | null
  ultima_busca_em: string | null
}

export interface AlertaCriado extends AlertaNovo {
  id: string
  /** Nome do cliente/documento monitorado (para o e-mail-resumo). */
  cliente: string
}

export interface ResumoMonitoramentoClientes {
  documentos: number
  consultas: number
  /** Processos distintos (por documento) em que o cliente apareceu, já filtrados por nome. */
  encontrados: number
  /** Alertas realmente criados nesta rodada. */
  novos: number
  falhas: number
  /** true se a rodada parou antes de percorrer todos os documentos (orçamento de tempo ou bloqueio 403). */
  interrompido: boolean
  erros: string[]
  alertas: AlertaCriado[]
}

export interface OpcoesExecutarMonitoramento {
  supabase: SupabaseClient
  /** Início da janela (AAAA-MM-DD). Padrão: `ate` − 3 dias. */
  desde?: string
  /** Fim da janela (AAAA-MM-DD). Padrão: hoje (São Paulo). */
  ate?: string
  fetchFn?: typeof fetch
  maxPaginas?: number
  pausaMs?: number
  sleep?: (ms: number) => Promise<void>
  orcamentoMs?: number
  /** Relógio injetável (ms) para o orçamento de tempo. */
  agora?: () => number
}

// ─── Janela e vigência ───────────────────────────────────────────────────────

/** Dentro da vigência na data `ate`. Sem datas, vale sempre. */
export function documentoNaVigencia(doc: Pick<DocumentoMonitorado, 'vigencia_inicio' | 'vigencia_fim'>, ate: string): boolean {
  if (doc.vigencia_inicio && doc.vigencia_inicio > ate) return false
  if (doc.vigencia_fim && doc.vigencia_fim < ate) return false
  return true
}

/**
 * Início da janela de um documento:
 *  - nunca buscado → backfill de 30 dias;
 *  - já buscado → recua até o dia da última busca (menos 1), no máximo 30 dias,
 *    para cobrir dias em que o cron não rodou;
 *  - nunca antes do início da vigência.
 * `desde` explícito e mais antigo (ex.: backfill manual) prevalece.
 */
export function desdeDoDocumento(
  doc: Pick<DocumentoMonitorado, 'ultima_busca_em' | 'vigencia_inicio'>,
  desde: string,
  ate: string,
): string {
  const limiteBackfill = somarDias(ate, -BACKFILL_DIAS)
  let inicio = desde
  if (!doc.ultima_busca_em) {
    if (limiteBackfill < inicio) inicio = limiteBackfill
  } else {
    const ultima = dataDeTimestamp(doc.ultima_busca_em)
    if (ultima) {
      const recuo = somarDias(ultima, -1)
      const catchUp = recuo > limiteBackfill ? recuo : limiteBackfill
      if (catchUp < inicio) inicio = catchUp
    }
  }
  if (doc.vigencia_inicio && inicio < doc.vigencia_inicio) inicio = doc.vigencia_inicio
  return inicio
}

/** Nomes a buscar (e a comparar): principal + variações, sem repetição. */
export function nomesDoDocumento(doc: Pick<DocumentoMonitorado, 'nome_principal' | 'nomes_busca'>): string[] {
  return nomesUnicos([doc.nome_principal, ...(doc.nomes_busca ?? [])])
}

// ─── Banco ───────────────────────────────────────────────────────────────────

/** Números (só dígitos) de todos os processos já cadastrados. */
export async function carregarNumerosConhecidos(supabase: SupabaseClient): Promise<Set<string>> {
  const conhecidos = new Set<string>()
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from('processos')
      .select('numero_processo')
      .not('numero_processo', 'is', null)
      .range(de, de + 999)
    if (error) throw new Error(`Falha ao ler processos: ${error.message}`)
    for (const linha of (data ?? []) as Array<{ numero_processo: string | null }>) {
      const digitos = soDigitosProcesso(linha.numero_processo)
      if (digitos) conhecidos.add(digitos)
    }
    if (!data || data.length < 1000) break
  }
  return conhecidos
}

// ─── Execução ────────────────────────────────────────────────────────────────

const MAX_ERROS_NO_RESUMO = 20

export async function executarMonitoramentoClientes(
  opcoes: OpcoesExecutarMonitoramento,
): Promise<ResumoMonitoramentoClientes> {
  const { supabase } = opcoes
  const ate = opcoes.ate ?? hojeSaoPaulo()
  const desde = opcoes.desde ?? somarDias(ate, -JANELA_PADRAO_DIAS)
  const agora = opcoes.agora ?? Date.now
  const inicioMs = agora()
  const orcamentoMs = opcoes.orcamentoMs ?? ORCAMENTO_MS_PADRAO

  const resumo: ResumoMonitoramentoClientes = {
    documentos: 0, consultas: 0, encontrados: 0, novos: 0, falhas: 0,
    interrompido: false, erros: [], alertas: [],
  }
  const pausaMs = opcoes.pausaMs ?? PAUSA_MS_PADRAO
  const sleep = opcoes.sleep ?? dormir
  let jaConsultou = false
  const registrarErro = (mensagem: string) => {
    resumo.falhas++
    if (resumo.erros.length < MAX_ERROS_NO_RESUMO) resumo.erros.push(mensagem)
  }

  // Quem foi buscado há mais tempo (ou nunca) vem primeiro: se o tempo acabar, o resto fica para amanhã.
  const { data: docs, error: erroDocs } = await supabase
    .from('monitoramento_documentos')
    .select('id, cliente_id, documento, tipo, nome_principal, nomes_busca, ativo, vigencia_inicio, vigencia_fim, ultima_busca_em')
    .eq('ativo', true)
    .order('ultima_busca_em', { ascending: true, nullsFirst: true })
  if (erroDocs && erroDeTabelaAusente(erroDocs)) throw new MigracaoPendenteErro()
  if (erroDocs) throw new Error(`Falha ao ler documentos monitorados: ${erroDocs.message}`)

  const ativos = ((docs ?? []) as DocumentoMonitorado[]).filter(d => documentoNaVigencia(d, ate))
  if (ativos.length === 0) return resumo

  const conhecidos = await carregarNumerosConhecidos(supabase)

  for (const doc of ativos) {
    if (agora() - inicioMs > orcamentoMs) { resumo.interrompido = true; break }
    resumo.documentos++

    const nomes = nomesDoDocumento(doc)
    const janelaDesde = desdeDoDocumento(doc, desde, ate)
    const itens: ComunicacaoDJEN[] = []
    let falhasDoDocumento = 0
    let bloqueado = false

    for (const nome of nomes) {
      // pequena pausa entre consultas (cortesia com a API do CNJ)
      if (jaConsultou && pausaMs > 0) await sleep(pausaMs)
      jaConsultou = true
      try {
        const r = await buscarComunicacoesPorNome({
          nome, desde: janelaDesde, ate,
          fetchFn: opcoes.fetchFn, maxPaginas: opcoes.maxPaginas, pausaMs, sleep,
        })
        resumo.consultas += r.consultas
        itens.push(...r.itens)
        if (r.truncado) registrarErro(`${doc.nome_principal}: resultado de "${nome}" truncado no limite de páginas (janela ${janelaDesde} a ${ate}).`)
      } catch (e) {
        falhasDoDocumento++
        if (e instanceof DjenErro && e.status === 403) bloqueado = true
        registrarErro(`${doc.nome_principal} ("${nome}"): ${e instanceof Error ? e.message : String(e)}`)
        if (bloqueado) break
      }
    }

    const agrupados = agruparPorProcesso(filtrarComunicacoes(itens, nomes))
    resumo.encontrados += agrupados.length
    const alertas = montarAlertas(doc.id, classificarProcessos(agrupados, conhecidos, doc.tipo))

    if (alertas.length > 0) {
      const { data: inseridos, error } = await supabase
        .from('monitoramento_alertas')
        .upsert(alertas, { onConflict: 'monitoramento_id,numero_processo', ignoreDuplicates: true })
        .select('id, numero_processo')
      if (error) {
        falhasDoDocumento++
        registrarErro(`${doc.nome_principal}: falha ao gravar alertas (${error.message}).`)
      } else {
        const porNumero = new Map(alertas.map(a => [a.numero_processo, a]))
        for (const linha of (inseridos ?? []) as Array<{ id: string; numero_processo: string }>) {
          const base = porNumero.get(linha.numero_processo)
          if (!base) continue
          resumo.novos++
          resumo.alertas.push({ ...base, id: linha.id, cliente: doc.nome_principal })
        }
      }
    }

    // Só avança a marca de "última busca" quando a rodada do documento foi limpa;
    // com falha, a próxima execução recua a janela e tenta de novo.
    if (falhasDoDocumento === 0) {
      const { error } = await supabase
        .from('monitoramento_documentos')
        .update({ ultima_busca_em: new Date().toISOString() })
        .eq('id', doc.id)
      if (error) registrarErro(`${doc.nome_principal}: falha ao registrar a última busca (${error.message}).`)
    }

    if (bloqueado) { resumo.interrompido = true; break }
  }

  return resumo
}
