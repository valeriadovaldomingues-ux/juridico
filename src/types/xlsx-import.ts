// ─────────────────────────────────────────────────────────────────────────────
// src/types/xlsx-import.ts
//
// Tipos para o importador de agenda EasyJur via arquivo .xlsx.
// O mapeamento de colunas é feito por ÍNDICE (posição), não por nome,
// pois o EasyJur exporta colunas em posições fixas e conhecidas.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Linha bruta do xlsx ──────────────────────────────────────────────────────

/** Linha do xlsx como array de strings (índice = coluna) */
export type XlsxRawRow = string[]

/** Linha do xlsx como objeto chave→valor (chave = cabeçalho original) */
export type XlsxRawObject = Record<string, string>

// ─── Evento normalizado ───────────────────────────────────────────────────────

/**
 * Um evento do EasyJur depois de mapeado e normalizado,
 * pronto para ser inserido/atualizado em calendar_events.
 */
export interface NormalizedCalendarEvent {
  // Fonte
  source:              'easyjur'
  source_file:         string
  source_event_id:     string | null   // col 0

  // Evento
  title:               string
  description:         string | null   // col 25
  resolution:          string | null   // col 26
  event_type:          string | null   // col 2  (AUDIENCIA, PRAZO, etc.)
  workflow_name:       string | null   // col 1

  // Status e datas
  status:              string | null   // col 24
  event_date:          string | null   // col 8  yyyy-mm-dd
  deadline_date:       string | null   // col 9  yyyy-mm-dd
  created_date:        string | null   // col 16 yyyy-mm-dd
  publication_date:    string | null   // col 14 yyyy-mm-dd
  start_time:          string | null   // col 17 HH:mm:ss
  end_time:            string | null   // col 18 HH:mm:ss

  // Responsáveis
  owner_name:          string | null   // col 4
  assigned_name:       string | null   // col 5

  // Partes
  client_name:         string | null   // col 6
  client_id_external:  string | null   // col 47
  opposing_party_name: string | null   // col 7
  parties_info:        string | null   // col 82

  // Processo (dados externos)
  process_id_external: string | null   // col 44
  process_number:      string | null   // col 53 (sem aspas)
  court:               string | null   // col 54
  county:              string | null   // col 55
  state:               string | null   // col 56
  court_branch:        string | null   // col 57
  court_rite:          string | null   // col 45
  judge_name:          string | null   // col 52
  matter:              string | null   // col 58
  procedural_role:     string | null   // col 59
  case_class:          string | null   // col 60
  case_value:          number | null   // col 61
  practice_area:       string | null   // col 73
  current_phase:       string | null   // col 76
  process_status:      string | null   // col 72
  distribution_date:   string | null   // col 68 yyyy-mm-dd
  process_type:        string | null   // col 66

  // Vínculo interno (resolvido durante confirm)
  process_internal_id: string | null

  // Payload bruto para auditoria
  raw_payload:         XlsxRawObject
}

// ─── Preview ──────────────────────────────────────────────────────────────────

export type XlsxImportRowStatus = 'new' | 'update' | 'duplicate' | 'error'

export interface XlsxPreviewRow extends NormalizedCalendarEvent {
  rowNumber:    number
  rowStatus:    XlsxImportRowStatus
  errorMessage: string | null
  existingId:   string | null
}

export interface XlsxPreviewSummary {
  total:       number
  newCount:    number
  updateCount: number
  skipCount:   number
  errorCount:  number
}

export interface XlsxPreviewResult {
  rows:          XlsxPreviewRow[]
  summary:       XlsxPreviewSummary
  filename:      string
  detectedType:  string   // ex: 'EasyJur Agenda Export'
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

export interface XlsxImportErrorRow {
  rowNumber: number
  error:     string
  raw:       XlsxRawObject
}

export interface XlsxConfirmResult {
  jobId:     string
  total:     number
  created:   number
  updated:   number
  skipped:   number
  errors:    number
  errorRows: XlsxImportErrorRow[]
}
