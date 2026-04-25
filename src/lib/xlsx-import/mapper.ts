// ─────────────────────────────────────────────────────────────────────────────
// src/lib/xlsx-import/mapper.ts
//
// Mapeamento por posição + normalização dos campos do EasyJur.
// Todas as funções são puras (sem side-effects).
// ─────────────────────────────────────────────────────────────────────────────

import { EASYJUR_COL } from './xlsx-parser'
import type { NormalizedCalendarEvent, XlsxRawObject } from '@/types/xlsx-import'

// ─── Helpers de limpeza ───────────────────────────────────────────────────────

function clean(s: string | undefined): string | null {
  const t = (s ?? '').trim()
  return t || null
}

/** Extrai o valor de uma coluna por índice */
function col(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

// ─── Conversão de data ────────────────────────────────────────────────────────

/**
 * Converte data brasileira (dd/mm/yyyy) para ISO (yyyy-mm-dd).
 * Também trata o formato que o xlsx às vezes retorna (m/d/yyyy).
 * Retorna null se inválida ou vazia.
 */
export function parseDateBR(s: string): string | null {
  if (!s?.trim()) return null
  const clean = s.trim()

  // dd/mm/yyyy (padrão EasyJur)
  let match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    const day = parseInt(d, 10), month = parseInt(m, 10), year = parseInt(y, 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  // ISO (yyyy-mm-dd) — já correto
  match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return clean

  return null
}

// ─── Conversão de hora ────────────────────────────────────────────────────────

/**
 * Normaliza horário EasyJur (HH:mm:ss ou HH:mm) para HH:mm:ss.
 * Ignora "00:00:00" pois representa ausência de hora específica.
 * Retorna null se inválido, vazio ou zero.
 */
export function parseTime(s: string): string | null {
  if (!s?.trim()) return null
  const clean = s.trim()
  if (clean === '00:00:00' || clean === '00:00') return null

  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const sec = match[3] ? parseInt(match[3], 10) : 0

  if (h > 23 || m > 59 || sec > 59) return null

  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

// ─── Conversão de valor monetário ────────────────────────────────────────────

/**
 * Converte valor brasileiro (151.836,80 ou 151836,80) para number.
 * Retorna null se zero, vazio ou inválido.
 */
export function parseMonetary(s: string): number | null {
  if (!s?.trim()) return null
  // Remove pontos de milhar e substitui vírgula decimal
  const normalized = s.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(normalized)
  if (isNaN(n) || n === 0) return null
  return n
}

// ─── Normalização do número do processo ──────────────────────────────────────

/**
 * Remove aspas duplas do número do processo e valida formato CNJ.
 * EasyJur exporta o número entre aspas: "0001310-55.2024.5.08.0130"
 */
export function cleanProcessNumber(s: string): string | null {
  if (!s?.trim()) return null
  const cleaned = s.trim().replace(/^"|"$/g, '').trim()
  // Valida formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  if (/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(cleaned)) return cleaned
  // Aceita qualquer string não-vazia com pelo menos um número
  if (/\d/.test(cleaned) && cleaned.length > 5) return cleaned
  return null
}

// ─── Normalização do tribunal ─────────────────────────────────────────────────

/**
 * Extrai o código curto do tribunal (ex: "TRT03") do texto completo.
 * "TRT03 - Tribunal Regional do Trabalho da 3ª Região" → "TRT03"
 */
export function extractCourtCode(s: string): string | null {
  if (!s?.trim()) return null
  const full = s.trim()
  // Extrai o prefixo antes do " - "
  const match = full.match(/^([A-Z0-9]+)\s*-/)
  return match ? match[1] : full || null
}

// ─── Geração de título ────────────────────────────────────────────────────────

const EVENT_TYPE_LABEL: Record<string, string> = {
  'AUDIENCIA':   'Audiência',
  'PRAZO':       'Prazo',
  'PERICIA':     'Perícia',
  'TAREFA':      'Tarefa',
  'CONSULTORIA': 'Consultoria',
}

/**
 * Gera o título do evento com base no tipo, cliente e número do processo.
 *
 * Exemplos:
 *   "Audiência – IRRICOM SERVICOS DE ENGENHARIA LTDA – 0010028-82.2026.5.03.0171"
 *   "Prazo – SOLUTTUS SOLUCOES INTELIGENTES LTDA"
 */
export function buildTitle(
  eventType:     string | null,
  clientName:    string | null,
  opposingParty: string | null,
  processNumber: string | null,
): string {
  const typeLabel  = (eventType ? EVENT_TYPE_LABEL[eventType] ?? eventType : 'Evento')
  const partyLabel = clientName ?? opposingParty ?? 'Sem parte'

  if (processNumber) {
    return `${typeLabel} – ${partyLabel} – ${processNumber}`
  }
  return `${typeLabel} – ${partyLabel}`
}

// ─── Mapeador principal ───────────────────────────────────────────────────────

/**
 * Converte uma linha bruta (array por índice de coluna) em NormalizedCalendarEvent.
 *
 * @param row      - Array de strings indexado pela posição da coluna
 * @param rawObj   - Objeto chave→valor para raw_payload
 * @param filename - Nome do arquivo de origem
 */
export function mapRow(
  row:      string[],
  rawObj:   XlsxRawObject,
  filename: string,
): { event: NormalizedCalendarEvent; error: string | null } {
  const get = (idx: number) => col(row, idx)

  // ── Validação mínima ─────────────────────────────────────────────────────────
  const eventDate = parseDateBR(get(EASYJUR_COL.EVENT_DATE))
  if (!eventDate) {
    return {
      event: buildFallbackEvent(rawObj, filename),
      error: `Data do evento inválida ou ausente: "${get(EASYJUR_COL.EVENT_DATE) || '(vazio)'}"`,
    }
  }

  // ── Campos principais ────────────────────────────────────────────────────────
  const sourceEventId  = clean(get(EASYJUR_COL.SOURCE_EVENT_ID))
  const eventType      = clean(get(EASYJUR_COL.EVENT_TYPE))
  const clientNameAgenda = clean(get(EASYJUR_COL.CLIENT_NAME))
  const clientNameProc   = clean(get(EASYJUR_COL.CLIENT_NAME_PROC))
  const clientName     = clientNameAgenda ?? clientNameProc
  const opposingParty  = clean(get(EASYJUR_COL.OPPOSING_PARTY)) ?? clean(get(EASYJUR_COL.OPPOSING_PARTY_PROC))
  const processNumber  = cleanProcessNumber(get(EASYJUR_COL.PROCESS_NUMBER))

  // ── Título gerado ────────────────────────────────────────────────────────────
  const title = buildTitle(eventType, clientName, opposingParty, processNumber)

  // ── Tribunal: extrai código curto ────────────────────────────────────────────
  const courtFull = clean(get(EASYJUR_COL.COURT))
  const court     = courtFull ? extractCourtCode(courtFull) : null

  const event: NormalizedCalendarEvent = {
    source:              'easyjur',
    source_file:         filename,
    source_event_id:     sourceEventId,

    title,
    description:         clean(get(EASYJUR_COL.DESCRIPTION)),
    resolution:          clean(get(EASYJUR_COL.RESOLUTION)),
    event_type:          eventType,
    workflow_name:       clean(get(EASYJUR_COL.WORKFLOW_NAME)),

    status:              clean(get(EASYJUR_COL.STATUS)),
    event_date:          eventDate,
    deadline_date:       parseDateBR(get(EASYJUR_COL.DEADLINE_DATE)),
    created_date:        parseDateBR(get(EASYJUR_COL.CREATED_DATE)),
    publication_date:    parseDateBR(get(EASYJUR_COL.PUBLICATION_DATE_AG)),
    start_time:          parseTime(get(EASYJUR_COL.START_TIME)),
    end_time:            parseTime(get(EASYJUR_COL.END_TIME)),

    owner_name:          clean(get(EASYJUR_COL.OWNER_NAME)),
    assigned_name:       clean(get(EASYJUR_COL.ASSIGNED_NAME)),

    client_name:         clientName,
    client_id_external:  clean(get(EASYJUR_COL.CLIENT_ID_EXT)),
    opposing_party_name: opposingParty,
    parties_info:        clean(get(EASYJUR_COL.PARTIES_INFO)),

    process_id_external: clean(get(EASYJUR_COL.PROCESS_ID_EXT)),
    process_number:      processNumber,
    court,
    county:              clean(get(EASYJUR_COL.COUNTY)),
    state:               clean(get(EASYJUR_COL.STATE)),
    court_branch:        clean(get(EASYJUR_COL.COURT_BRANCH)),
    court_rite:          clean(get(EASYJUR_COL.COURT_RITE)),
    judge_name:          clean(get(EASYJUR_COL.JUDGE)),
    matter:              clean(get(EASYJUR_COL.MATTER)),
    procedural_role:     clean(get(EASYJUR_COL.PROCEDURAL_ROLE)),
    case_class:          clean(get(EASYJUR_COL.CASE_CLASS)),
    case_value:          parseMonetary(get(EASYJUR_COL.CASE_VALUE)),
    practice_area:       clean(get(EASYJUR_COL.PRACTICE_AREA)),
    current_phase:       clean(get(EASYJUR_COL.CURRENT_PHASE)),
    process_status:      clean(get(EASYJUR_COL.PROCESS_STATUS)),
    distribution_date:   parseDateBR(get(EASYJUR_COL.DISTRIBUTION_DATE)),
    process_type:        clean(get(EASYJUR_COL.PROCESS_TYPE)),

    process_internal_id: null, // resolvido no confirm

    raw_payload: rawObj,
  }

  return { event, error: null }
}

function buildFallbackEvent(raw: XlsxRawObject, filename: string): NormalizedCalendarEvent {
  return {
    source: 'easyjur', source_file: filename, source_event_id: null,
    title: 'Linha com erro de importação', description: null, resolution: null,
    event_type: null, workflow_name: null, status: null,
    event_date: null, deadline_date: null, created_date: null,
    publication_date: null, start_time: null, end_time: null,
    owner_name: null, assigned_name: null, client_name: null,
    client_id_external: null, opposing_party_name: null, parties_info: null,
    process_id_external: null, process_number: null, court: null,
    county: null, state: null, court_branch: null, court_rite: null,
    judge_name: null, matter: null, procedural_role: null, case_class: null,
    case_value: null, practice_area: null, current_phase: null,
    process_status: null, distribution_date: null, process_type: null,
    process_internal_id: null, raw_payload: raw,
  }
}
