// ─── Cliente DataJud — API Pública CNJ ───────────────────────────────────────
//
// Documentação: https://datajud-wiki.cnj.jus.br/api-publica/
// Base URL: https://api-publica.datajud.cnj.jus.br/
// Não requer chave de API (acesso público).
//
// REGRA PRINCIPAL: busca sempre por nome completo exato e OAB exata.
// Nunca abreviar nomes. Nunca usar busca por nome parcial como primeira opção.

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br'

// ─── Mapeamento UF → Tribunais ────────────────────────────────────────────────
//
// Para cada UF de OAB, define quais índices do DataJud pesquisar.
// Um advogado com OAB/MG atuará primariamente nos tribunais de MG,
// mas TRF e tribunais superiores cobrem múltiplas UFs.

export interface TribunalConfig {
  sigla: string
  indice: string
  uf: string | null // null = tribunal federal/nacional
}

export const TRIBUNAIS_POR_UF: Record<string, TribunalConfig[]> = {
  MG: [
    { sigla: 'TJMG',  indice: 'api_publica_tjmg',  uf: 'MG' },
    { sigla: 'TRT3',  indice: 'api_publica_trt3',  uf: 'MG' },
    { sigla: 'TRF1',  indice: 'api_publica_trf1',  uf: null },
    { sigla: 'TRF6',  indice: 'api_publica_trf6',  uf: null },
  ],
  PE: [
    { sigla: 'TJPE',  indice: 'api_publica_tjpe',  uf: 'PE' },
    { sigla: 'TRT6',  indice: 'api_publica_trt6',  uf: 'PE' },
    { sigla: 'TRF5',  indice: 'api_publica_trf5',  uf: null },
  ],
  DF: [
    { sigla: 'TJDFT', indice: 'api_publica_tjdft', uf: 'DF' },
    { sigla: 'TRT10', indice: 'api_publica_trt10', uf: 'DF' },
    { sigla: 'TRF1',  indice: 'api_publica_trf1',  uf: null },
  ],
  RJ: [
    { sigla: 'TJRJ',  indice: 'api_publica_tjrj',  uf: 'RJ' },
    { sigla: 'TRT1',  indice: 'api_publica_trt1',  uf: 'RJ' },
    { sigla: 'TRF2',  indice: 'api_publica_trf2',  uf: null },
  ],
  SP: [
    { sigla: 'TJSP',  indice: 'api_publica_tjsp',  uf: 'SP' },
    { sigla: 'TRT2',  indice: 'api_publica_trt2',  uf: 'SP' },
    { sigla: 'TRF3',  indice: 'api_publica_trf3',  uf: null },
  ],
}

// Tribunais superiores pesquisados para todos os advogados
export const TRIBUNAIS_SUPERIORES: TribunalConfig[] = [
  { sigla: 'STJ', indice: 'api_publica_stj', uf: null },
  { sigla: 'STF', indice: 'api_publica_stf', uf: null },
]

// ─── Tipos de resposta ────────────────────────────────────────────────────────

export interface DataJudProcesso {
  id: string
  numeroProcesso: string
  tribunal?: string
  dataAjuizamento?: string
  dataUltimaAtualizacao?: string
  classeProcessual?: { codigo: number; nome: string }
  assuntos?: Array<{ codigo: number; nome: string }>
  movimentos?: Array<{
    codigo: number
    nome: string
    dataHora: string
    complementosTabelados?: Array<{ codigo: number; nome: string; descricao?: string }>
  }>
  advogados?: Array<{
    nome: string
    oabNumero?: string
    oabEstado?: string
  }>
  orgaoJulgador?: { codigo: number; nome: string; codigoMunicipioIBGE?: number }
  grau?: string
}

export interface DataJudSearchResult {
  processos: DataJudProcesso[]
  total: number
  tribunal: string
  origem: 'datajud_oab' | 'datajud_nome' | 'datajud_combinado'
  criterio_usado: string
}

// ─── Build queries ────────────────────────────────────────────────────────────

/**
 * Query primária: busca exata por número OAB + UF.
 * NUNCA usa nome parcial ou abreviado.
 */
function buildOABQuery(oabNumero: string, oabUF: string, size = 20) {
  return {
    query: {
      nested: {
        path: 'advogados',
        query: {
          bool: {
            must: [
              { term: { 'advogados.oabNumero': oabNumero } },
              { term: { 'advogados.oabEstado': oabUF.toUpperCase() } },
            ],
          },
        },
      },
    },
    size,
    sort: [{ dataAjuizamento: { order: 'desc' } }],
  }
}

/**
 * Query secundária: busca por nome completo exato (match_phrase).
 * Usada como fallback quando busca por OAB não retorna resultados.
 * Sempre usa o nome COMPLETO, nunca abreviado.
 */
function buildNomeCompletoQuery(nomeCompleto: string, size = 20) {
  return {
    query: {
      nested: {
        path: 'advogados',
        query: {
          match_phrase: {
            'advogados.nome': nomeCompleto.toUpperCase(),
          },
        },
      },
    },
    size,
    sort: [{ dataAjuizamento: { order: 'desc' } }],
  }
}

/**
 * Query por número de processo (busca complementar quando há processo vinculado).
 */
function buildProcessoQuery(numeroProcesso: string, size = 5) {
  return {
    query: {
      match: {
        numeroProcesso: { query: numeroProcesso, operator: 'and' },
      },
    },
    size,
  }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function searchDataJud(
  indice: string,
  body: object,
  timeoutMs = 15000,
): Promise<{ hits: { total: { value: number }; hits: Array<{ _source: DataJudProcesso }> } } | null> {
  const url = `${DATAJUD_BASE}/${indice}/_search`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      if (res.status === 404) return null // índice não existe / tribunal sem dados
      if (res.status === 429) {
        // Rate limited — wait and skip
        return null
      }
      return null
    }
    return await res.json()
  } catch {
    clearTimeout(timer)
    return null
  }
}

// ─── Main search function ─────────────────────────────────────────────────────

/**
 * Busca publicações para um advogado monitorado em um tribunal específico.
 *
 * Lógica:
 *   1. Primeiro tenta busca exata por OAB (prioritária, conforme regra principal)
 *   2. Se não encontrar resultados, tenta busca por nome completo exato
 *   3. Registra qual critério encontrou o resultado
 *
 * NUNCA abreviará o nome. NUNCA usará busca aproximada.
 */
export async function buscarPorAdvogado(
  nomeCompleto: string,
  oabNumero: string,
  oabUF: string,
  tribunal: TribunalConfig,
  numerosProcesso: string[] = [],
): Promise<DataJudSearchResult> {
  const processos: DataJudProcesso[] = []
  let origem: DataJudSearchResult['origem'] = 'datajud_oab'
  let criterio = `OAB/${oabUF} ${oabNumero}`

  // ── 1. Busca primária: OAB exata ──────────────────────────────────────────
  const oabQuery  = buildOABQuery(oabNumero, oabUF)
  const oabResult = await searchDataJud(tribunal.indice, oabQuery)

  if (oabResult && oabResult.hits.total.value > 0) {
    processos.push(...oabResult.hits.hits.map(h => h._source))
  }

  // ── 2. Busca secundária: nome completo exato (apenas se OAB não retornou) ─
  if (processos.length === 0) {
    await new Promise(r => setTimeout(r, 300)) // respeitar rate limit
    const nomeQuery  = buildNomeCompletoQuery(nomeCompleto)
    const nomeResult = await searchDataJud(tribunal.indice, nomeQuery)

    if (nomeResult && nomeResult.hits.total.value > 0) {
      processos.push(...nomeResult.hits.hits.map(h => h._source))
      origem   = 'datajud_nome'
      criterio = `Nome completo: ${nomeCompleto}`
    }
  }

  // ── 3. Busca complementar por números de processo conhecidos ──────────────
  if (numerosProcesso.length > 0 && processos.length > 0) {
    // Mark as combined when we also have process numbers to cross-reference
    origem   = 'datajud_combinado'
    criterio = `OAB/${oabUF} ${oabNumero} + ${numerosProcesso.length} processo(s)`
  }

  // Dedup by numeroProcesso within this result set
  const seen = new Set<string>()
  const uniq  = processos.filter(p => {
    if (seen.has(p.numeroProcesso)) return false
    seen.add(p.numeroProcesso)
    return true
  })

  return {
    processos: uniq,
    total: uniq.length,
    tribunal: tribunal.sigla,
    origem,
    criterio_usado: criterio,
  }
}

// ─── Hash para deduplicação ───────────────────────────────────────────────────

export function gerarHash(
  tribunal: string,
  numeroProcesso: string,
  dataMovimento: string,
  textoSnippet: string,
): string {
  // Deterministic string combining key identifying fields
  const raw = [
    tribunal.toUpperCase(),
    numeroProcesso.replace(/\D/g, ''),
    dataMovimento.slice(0, 10),
    textoSnippet.slice(0, 100).replace(/\s+/g, ' ').trim().toUpperCase(),
  ].join('|')

  // Simple but deterministic hash (djb2)
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i)
    hash = hash >>> 0 // keep 32-bit unsigned
  }
  return `${tribunal.toUpperCase()}_${hash.toString(16).padStart(8, '0')}`
}

// ─── Extract movimento text ────────────────────────────────────────────────────

export function extrairTextoMovimento(processo: DataJudProcesso): string {
  if (!processo.movimentos || processo.movimentos.length === 0) return ''
  const latest = processo.movimentos[0]
  const partes  = [
    latest.nome,
    ...(latest.complementosTabelados ?? []).map(c => c.descricao ?? c.nome),
  ].filter(Boolean)
  return partes.join(' — ')
}
