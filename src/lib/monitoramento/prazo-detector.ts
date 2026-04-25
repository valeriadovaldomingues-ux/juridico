// ─── Detector de prazos e audiências em textos de publicações ─────────────────
//
// Analisa texto de publicações judiciais brasileiras para identificar:
//   - menções a prazos (com número de dias quando possível)
//   - menções a audiências (com data quando possível)
//   - necessidades de providência (intime-se, cite-se, etc.)

export interface DetectionResult {
  prazo_detectado: boolean
  prazo_dias?: number
  prazo_data?: string     // ISO date
  prazo_descricao?: string

  audiencia_detectada: boolean
  audiencia_data?: string // ISO date
  audiencia_descricao?: string
}

// ─── Padrões de prazo ─────────────────────────────────────────────────────────

const PRAZO_PATTERNS = [
  // "prazo de 15 (quinze) dias"
  /prazo\s+de\s+(\d+)\s*(?:\([^)]+\)\s*)?dias?/gi,
  // "no prazo de 30 dias"
  /no\s+prazo\s+(?:improrrog[aá]vel\s+)?de\s+(\d+)\s*(?:\([^)]+\)\s*)?dias?/gi,
  // "prazo de 5 dias úteis"
  /prazo\s+de\s+(\d+)\s*dias?\s*[úu]teis?/gi,
  // "no prazo legal"
  /no\s+prazo\s+legal/gi,
  // "até o dia DD/MM/AAAA"
  /at[eé]\s+o\s+dia\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
  // "prazo fatal"
  /prazo\s+fatal/gi,
  // "improrrogável"
  /improrrog[aá]vel/gi,
  // "responda em X dias"
  /responda?\s+(?:em|no\s+prazo\s+de)\s+(\d+)\s*dias?/gi,
  // "manifestem-se em X dias"
  /manifest[ae](?:m-se|r)?\s+(?:em|no\s+prazo\s+de)\s+(\d+)\s*dias?/gi,
  // "apresente em X dias"
  /apresente?\s+(?:em|no\s+prazo\s+de)\s+(\d+)\s*dias?/gi,
  // "recurso em X dias"
  /recurs[oa]\s+(?:em|no\s+prazo\s+de)\s+(\d+)\s*dias?/gi,
  // "contrarrazões em X dias"
  /contrarraz[oõ]es?\s+(?:em|no\s+prazo\s+de)\s+(\d+)\s*dias?/gi,
  // "no prazo de X dias" / "prazo de X dias" / "em X dias" (genérico, word boundary)
  /\b(?:no prazo de|prazo de|em)\s+(\d{1,3})\s+dias?\b/gi,
  // Providência terms
  /\b(?:intime-se|cite-se|notifique-se|cumpra-se|diligencie-se|certifique-se)\b/gi,
]

const PRAZO_DATE_PATTERN = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/

// Padrões exportados para uso externo
export const REGEX_DATA_BR  = /\b\d{2}\/\d{2}\/\d{4}\b/
export const REGEX_HORA     = /\b\d{1,2}:\d{2}\b/

// ─── Padrões de audiência ─────────────────────────────────────────────────────

const AUDIENCIA_PATTERNS = [
  // "audiência de instrução e julgamento designada para"
  /audi[eê]ncia\s+(?:de\s+[^,.\n]+)?\s*(?:designad[ao]|marcad[ao]|agendad[ao])?\s*para\s+(?:o\s+dia\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
  // "audiência para o dia"
  /audi[eê]ncia\s+para\s+(?:o\s+dia\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
  // genérico — termos de ato presencial (com captura do tipo para descrição)
  /\b(audi[eê]ncia|sess[aã]o de julgamento|concilia[cç][aã]o|instru[cç][aã]o)\b/gi,
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBRDate(str: string): string | undefined {
  const match = str.match(PRAZO_DATE_PATTERN)
  if (!match) return undefined
  const [, d, m, y] = match
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

function extractDaysFromMatch(text: string, pattern: RegExp): number | undefined {
  const re = new RegExp(pattern.source, pattern.flags)
  const match = re.exec(text)
  if (match && match[1]) {
    const n = parseInt(match[1], 10)
    if (!isNaN(n) && n > 0 && n <= 365) return n
  }
  return undefined
}

// ─── Main detector ────────────────────────────────────────────────────────────

export function detectarPrazosEAudiencias(texto: string): DetectionResult {
  if (!texto) {
    return { prazo_detectado: false, audiencia_detectada: false }
  }

  const result: DetectionResult = {
    prazo_detectado: false,
    audiencia_detectada: false,
  }

  // ─── Prazos ───────────────────────────────────────────────────────────────

  const prazosEncontrados: string[] = []
  let prazo_dias: number | undefined
  let prazo_data: string | undefined

  for (const pattern of PRAZO_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    const match = re.exec(texto)
    if (match) {
      result.prazo_detectado = true
      prazosEncontrados.push(match[0])

      // Extract days from first capture group
      if (match[1] && /^\d+$/.test(match[1])) {
        const dias = parseInt(match[1], 10)
        if (!isNaN(dias) && dias > 0 && dias <= 365) {
          prazo_dias = prazo_dias ?? dias
        }
      }

      // Extract date from match
      const dateStr = parseBRDate(match[0])
      if (dateStr) prazo_data = prazo_data ?? dateStr
    }
  }

  if (result.prazo_detectado) {
    if (prazo_dias)  result.prazo_dias = prazo_dias
    if (prazo_data)  result.prazo_data = prazo_data
    result.prazo_descricao = prazosEncontrados
      .slice(0, 3)
      .join(' | ')
      .slice(0, 300)
  }

  // ─── Audiências ───────────────────────────────────────────────────────────

  const audienciasEncontradas: string[] = []
  let audiencia_data: string | undefined

  for (const pattern of AUDIENCIA_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    const match = re.exec(texto)
    if (match) {
      result.audiencia_detectada = true
      audienciasEncontradas.push(match[0])

      // Extract date from match[1] if it has a capture group
      if (match[1]) {
        const dateStr = parseBRDate(match[1])
        if (dateStr) audiencia_data = audiencia_data ?? dateStr
      }
    }
  }

  if (result.audiencia_detectada) {
    if (audiencia_data) result.audiencia_data = audiencia_data
    result.audiencia_descricao = audienciasEncontradas
      .slice(0, 3)
      .join(' | ')
      .slice(0, 300)
  }

  return result
}

// ─── Extração rápida de número de dias ───────────────────────────────────────

export function extrairPrazoDias(texto: string): number | null {
  const limpo = texto.toLowerCase().replace(/\s+/g, ' ').trim()
  const match = limpo.match(/\b(?:no prazo de|prazo de|em)\s+(\d{1,3})\s+dias?\b/)
  return match ? Number(match[1]) : null
}

// ─── Extração de data e hora ─────────────────────────────────────────────────

/** Retorna a primeira data no formato DD/MM/AAAA encontrada no texto. */
export function extrairDataBR(texto: string): string | null {
  return texto.match(REGEX_DATA_BR)?.[0] ?? null
}

/** Retorna o primeiro horário no formato HH:MM encontrado no texto. */
export function extrairHora(texto: string): string | null {
  return texto.match(REGEX_HORA)?.[0] ?? null
}

// ─── Análise consolidada de publicação ───────────────────────────────────────

type Deteccao = {
  numeroProcesso:      string | null
  prazoDias:           number | null
  prazoDetectado:      boolean
  audienciaDetectada:  boolean
  providenciaDetectada: boolean
  resumo:              string[]
}

export function analisarPublicacao(texto: string): Deteccao {
  const t = texto.toLowerCase().replace(/\s+/g, ' ').trim()

  const numeroProcesso =
    texto.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0] ?? null

  const prazoDias =
    t.match(/\b(?:no prazo de|prazo de|em)\s+(\d{1,3})\s+dias?\b/)?.[1]
      ? Number(t.match(/\b(?:no prazo de|prazo de|em)\s+(\d{1,3})\s+dias?\b/)![1])
      : null

  const audienciaDetectada =
    /\b(audi[eê]ncia|sess[aã]o de julgamento|concilia[cç][aã]o|instru[cç][aã]o)\b/.test(t)

  const providenciaDetectada =
    /\b(intime-se|intimar|intimada|manifestar-se|manifestação|contestação|contrarrazões|impugnação|defesa)\b/.test(t)

  const prazoDetectado = prazoDias !== null || /\bno prazo legal\b/.test(t)

  const resumo: string[] = []
  if (numeroProcesso)      resumo.push(`Processo: ${numeroProcesso}`)
  if (prazoDias)           resumo.push(`Prazo de ${prazoDias} dias`)
  if (audienciaDetectada)  resumo.push('Audiência detectada')
  if (providenciaDetectada) resumo.push('Providência detectada')

  return {
    numeroProcesso,
    prazoDias,
    prazoDetectado,
    audienciaDetectada,
    providenciaDetectada,
    resumo,
  }
}

// ─── Detect tipo de resultado ─────────────────────────────────────────────────

export function detectarTipoResultado(texto: string): string {
  const t = texto.toLowerCase()
  if (/\bintim[ae]/i.test(t) || /\bintimaç/i.test(t)) return 'intimacao'
  if (/\bsentença\b|\bsenten[cç]/i.test(t)) return 'sentenca'
  if (/\bacórd[aã]o\b|\bacord[aã]/i.test(t)) return 'acordao'
  if (/\bdespach[oa]\b/i.test(t)) return 'despacho'
  return 'publicacao'
}
