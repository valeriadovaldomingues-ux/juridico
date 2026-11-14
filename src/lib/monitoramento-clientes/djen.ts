// ─── Consulta ao DJEN por nome da parte ──────────────────────────────────────
//
// GET https://comunicaapi.pje.jus.br/api/v1/comunicacao
//   nomeParte, dataDisponibilizacaoInicio, dataDisponibilizacaoFim (AAAA-MM-DD),
//   pagina (0-based), itensPorPagina (até 100).
// Só leitura. O fetch é injetável para os testes (sem rede).
//
// Limitação do CNJ: o WAF pode recusar IPs de datacenter (HTTP 403). O erro
// carrega `status` para o chamador poder interromper a rodada.

import type { ComunicacaoDJEN } from './comunicacoes'

export const DJEN_API_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
export const ITENS_POR_PAGINA = 100
export const MAX_PAGINAS_PADRAO = 5
export const TIMEOUT_MS_PADRAO = 30_000
export const PAUSA_MS_PADRAO = 500

export class DjenErro extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'DjenErro'
  }
}

export interface OpcoesBuscaDjen {
  nome: string
  /** AAAA-MM-DD */
  desde: string
  /** AAAA-MM-DD */
  ate: string
  fetchFn?: typeof fetch
  maxPaginas?: number
  itensPorPagina?: number
  timeoutMs?: number
  pausaMs?: number
  sleep?: (ms: number) => Promise<void>
}

export interface ResultadoBuscaDjen {
  itens: ComunicacaoDJEN[]
  /** Quantas requisições HTTP foram feitas. */
  consultas: number
  /** true se parou no limite de páginas com mais resultados disponíveis. */
  truncado: boolean
}

export const dormir = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function consultarPagina(
  fetchFn: typeof fetch,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<{ count?: number; items: ComunicacaoDJEN[] }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchFn(`${DJEN_API_URL}?${new URLSearchParams(params).toString()}`, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; monitoramento-juridico/1.0)',
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      throw new DjenErro(
        res.status === 403
          ? 'DJEN recusou a consulta (HTTP 403 — bloqueio do WAF do CNJ a IP de servidor).'
          : `DJEN indisponível: HTTP ${res.status}`,
        res.status,
      )
    }
    const json = (await res.json()) as { count?: number; items?: ComunicacaoDJEN[] }
    return { count: json.count, items: Array.isArray(json.items) ? json.items : [] }
  } catch (e) {
    if (e instanceof DjenErro) throw e
    if (e instanceof Error && e.name === 'AbortError') throw new DjenErro(`DJEN não respondeu em ${timeoutMs / 1000}s.`)
    throw new DjenErro(`Falha ao consultar o DJEN: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** Busca TODAS as comunicações (paginadas, com limite) em que o nome aparece como parte. */
export async function buscarComunicacoesPorNome(opcoes: OpcoesBuscaDjen): Promise<ResultadoBuscaDjen> {
  const fetchFn = opcoes.fetchFn ?? fetch
  const sleep = opcoes.sleep ?? dormir
  const maxPaginas = opcoes.maxPaginas ?? MAX_PAGINAS_PADRAO
  const porPagina = opcoes.itensPorPagina ?? ITENS_POR_PAGINA
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_MS_PADRAO
  const pausaMs = opcoes.pausaMs ?? PAUSA_MS_PADRAO

  const itens: ComunicacaoDJEN[] = []
  let consultas = 0
  let truncado = false

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    if (pagina > 0 && pausaMs > 0) await sleep(pausaMs)
    const resposta = await consultarPagina(fetchFn, {
      nomeParte: opcoes.nome,
      dataDisponibilizacaoInicio: opcoes.desde,
      dataDisponibilizacaoFim: opcoes.ate,
      pagina: String(pagina),
      itensPorPagina: String(porPagina),
    }, timeoutMs)
    consultas++
    itens.push(...resposta.items)

    const total = typeof resposta.count === 'number' ? resposta.count : null
    // Com `count` confiável, ele manda (a API pode devolver menos que itensPorPagina por página);
    // sem `count`, página incompleta indica o fim.
    const acabou = resposta.items.length === 0
      || (total !== null ? itens.length >= total : resposta.items.length < porPagina)
    if (acabou) return { itens, consultas, truncado: false }
    if (pagina === maxPaginas - 1) truncado = true
  }
  return { itens, consultas, truncado }
}
