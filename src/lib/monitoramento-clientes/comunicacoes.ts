// ─── Filtro, agrupamento e classificação das comunicações do DJEN ───────────
//
// Funções puras (sem rede, sem banco). O fluxo é:
//   itens do DJEN → filtrarComunicacoes (só nome IGUAL ao monitorado)
//                 → agruparPorProcesso  (1 linha por nº de processo)
//                 → classificarProcessos (novo × já cadastrado)
//                 → montarAlertas        (linhas prontas para o upsert)

import { nomesIguais } from './nomes'
import type { TipoDocumento } from './documento'

export interface DestinatarioDJEN {
  nome?: string | null
  polo?: string | null
}

/** Item devolvido por GET /api/v1/comunicacao (só os campos que usamos). */
export interface ComunicacaoDJEN {
  id?: number | string
  numero_processo?: string | null
  numeroprocessocommascara?: string | null
  siglaTribunal?: string | null
  tipoComunicacao?: string | null
  data_disponibilizacao?: string | null
  datadisponibilizacao?: string | null
  nomeOrgao?: string | null
  link?: string | null
  destinatarios?: DestinatarioDJEN[] | null
}

export type Polo = 'A' | 'P'

export interface ComunicacaoFiltrada {
  item: ComunicacaoDJEN
  /** Nome do destinatário como veio do DJEN (a grafia do tribunal). */
  nomeEncontrado: string
  /** Polo do cliente na comunicação; null quando o DJEN não informou. */
  polo: Polo | null
}

export interface ProcessoAgrupado {
  /** 20 dígitos, sem máscara. */
  numero_processo: string
  tribunal: string | null
  orgao: string | null
  polo: Polo | null
  tipo_comunicacao: string | null
  /** Publicação mais antiga do período, AAAA-MM-DD. */
  data_disponibilizacao: string | null
  nome_encontrado: string
  link: string | null
  /** Quantas comunicações do período citam o cliente neste processo. */
  ocorrencias: number
}

export type Classificacao = 'novo_processo' | 'processo_conhecido'

export interface ProcessoClassificado extends ProcessoAgrupado {
  classificacao: Classificacao
  possivel_homonimo: boolean
}

export interface AlertaNovo {
  monitoramento_id: string
  numero_processo: string
  tribunal: string | null
  orgao: string | null
  polo: Polo | null
  tipo_comunicacao: string | null
  data_disponibilizacao: string | null
  nome_encontrado: string
  link: string | null
  classificacao: Classificacao
  possivel_homonimo: boolean
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

export function soDigitosProcesso(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '')
}

/** Número do processo (20 dígitos) da comunicação, ou null se não houver um válido. */
export function numeroDoItem(item: ComunicacaoDJEN): string | null {
  for (const candidato of [item.numero_processo, item.numeroprocessocommascara]) {
    const digitos = soDigitosProcesso(candidato)
    if (digitos.length === 20) return digitos
  }
  return null
}

function normalizarPolo(polo: string | null | undefined): Polo | null {
  const p = String(polo ?? '').trim().toUpperCase()
  if (p === 'P' || p === 'PASSIVO') return 'P'
  if (p === 'A' || p === 'ATIVO') return 'A'
  return null
}

/** Aceita "AAAA-MM-DD" (com ou sem hora) e "DD/MM/AAAA"; devolve AAAA-MM-DD ou null. */
export function dataDJEN(item: ComunicacaoDJEN): string | null {
  for (const bruto of [item.data_disponibilizacao, item.datadisponibilizacao]) {
    const texto = String(bruto ?? '').trim()
    const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
    const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (br) return `${br[3]}-${br[2]}-${br[1]}`
  }
  return null
}

// ─── 1. Filtro: só nome igual ao monitorado ──────────────────────────────────

/**
 * Mantém só as comunicações em que algum destinatário tem nome IGUAL (ver nomes.ts)
 * a um dos nomes monitorados. A busca do DJEN é difusa; este filtro é obrigatório.
 * Se o cliente aparece em mais de um destinatário, prefere o polo passivo.
 */
export function filtrarComunicacoes(
  itens: ComunicacaoDJEN[],
  nomesMonitorados: string[],
): ComunicacaoFiltrada[] {
  const saida: ComunicacaoFiltrada[] = []
  for (const item of itens) {
    const casados = (item.destinatarios ?? []).filter(dest =>
      dest?.nome && nomesMonitorados.some(nome => nomesIguais(nome, dest.nome)),
    )
    if (casados.length === 0) continue
    const escolhido = casados.find(d => normalizarPolo(d.polo) === 'P') ?? casados[0]
    saida.push({
      item,
      nomeEncontrado: String(escolhido.nome).trim(),
      polo: normalizarPolo(escolhido.polo),
    })
  }
  return saida
}

// ─── 2. Agrupamento por número de processo ───────────────────────────────────

/**
 * Uma linha por processo. Os dados vêm da publicação MAIS ANTIGA do período
 * (é a que marca "quando o processo apareceu"); o polo cai para qualquer outra
 * publicação do mesmo processo se a mais antiga não o informar.
 * Comunicações sem número de processo válido (20 dígitos) são ignoradas.
 */
export function agruparPorProcesso(filtradas: ComunicacaoFiltrada[]): ProcessoAgrupado[] {
  const grupos = new Map<string, ComunicacaoFiltrada[]>()
  for (const f of filtradas) {
    const numero = numeroDoItem(f.item)
    if (!numero) continue
    const lista = grupos.get(numero) ?? []
    lista.push(f)
    grupos.set(numero, lista)
  }

  const saida: ProcessoAgrupado[] = []
  for (const [numero, lista] of grupos) {
    // sem data fica por último; empate mantém a ordem de chegada (sort estável)
    const ordenadas = [...lista].sort((a, b) => (dataDJEN(a.item) ?? '9999-99-99').localeCompare(dataDJEN(b.item) ?? '9999-99-99'))
    const primeira = ordenadas[0]
    saida.push({
      numero_processo: numero,
      tribunal: primeira.item.siglaTribunal ?? null,
      orgao: primeira.item.nomeOrgao ?? null,
      polo: primeira.polo ?? ordenadas.find(o => o.polo)?.polo ?? null,
      tipo_comunicacao: primeira.item.tipoComunicacao ?? null,
      data_disponibilizacao: dataDJEN(primeira.item),
      nome_encontrado: primeira.nomeEncontrado,
      link: primeira.item.link ?? null,
      ocorrencias: lista.length,
    })
  }
  return saida.sort((a, b) => a.numero_processo.localeCompare(b.numero_processo))
}

// ─── 3. Classificação novo × conhecido ───────────────────────────────────────

/**
 * `novo_processo` quando o número (só dígitos) NÃO está em `numerosConhecidos`
 * (os números de `processos.numero_processo`, também só dígitos).
 * `possivel_homonimo`: para CPF só temos o nome, então SEMPRE pode ser homônimo;
 * para CNPJ o nome empresarial é praticamente único (mantém false).
 */
export function classificarProcessos(
  processos: ProcessoAgrupado[],
  numerosConhecidos: ReadonlySet<string>,
  tipoDocumento: TipoDocumento,
): ProcessoClassificado[] {
  return processos.map(p => ({
    ...p,
    classificacao: numerosConhecidos.has(p.numero_processo) ? 'processo_conhecido' : 'novo_processo',
    possivel_homonimo: tipoDocumento === 'cpf',
  }))
}

// ─── 4. Montagem dos alertas ─────────────────────────────────────────────────

/**
 * Linhas para inserir em monitoramento_alertas. Por padrão, SÓ processos novos
 * (processo já cadastrado não gera alerta). Idempotente: um número aparece uma
 * vez só, e o banco ainda protege com unique (monitoramento_id, numero_processo)
 * + "on conflict do nothing".
 */
export function montarAlertas(
  monitoramentoId: string,
  classificados: ProcessoClassificado[],
  opcoes: { incluirConhecidos?: boolean } = {},
): AlertaNovo[] {
  const vistos = new Set<string>()
  const saida: AlertaNovo[] = []
  for (const c of classificados) {
    if (vistos.has(c.numero_processo)) continue
    if (c.classificacao === 'processo_conhecido' && !opcoes.incluirConhecidos) continue
    vistos.add(c.numero_processo)
    saida.push({
      monitoramento_id: monitoramentoId,
      numero_processo: c.numero_processo,
      tribunal: c.tribunal,
      orgao: c.orgao,
      polo: c.polo,
      tipo_comunicacao: c.tipo_comunicacao,
      data_disponibilizacao: c.data_disponibilizacao,
      nome_encontrado: c.nome_encontrado,
      link: c.link,
      classificacao: c.classificacao,
      possivel_homonimo: c.possivel_homonimo,
    })
  }
  return saida
}
