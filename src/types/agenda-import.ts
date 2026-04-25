// ─────────────────────────────────────────────────────────────────────────────
// src/types/agenda-import.ts
//
// Tipos para o importador de agenda EasyJur.
// ─────────────────────────────────────────────────────────────────────────────

/** Classificação de cada linha durante o preview */
export type ImportRowStatus = 'new' | 'update' | 'duplicate' | 'error'

/** Status gravado na tabela agenda_import_rows */
export type ImportRowDbStatus = 'created' | 'updated' | 'skipped' | 'error'

/** Linha do CSV com as chaves originais do EasyJur */
export type RawCsvRow = Record<string, string>

// ─── Linha normalizada ────────────────────────────────────────────────────────

/**
 * Uma linha do CSV depois de mapeada, convertida e validada,
 * mas antes de ser gravada no banco.
 */
export interface NormalizedAgendaRow {
  // Campos principais
  titulo:              string
  descricao:           string | null
  tipo:                'tarefa' | 'evento' | 'prazo' | 'audiencia'
  subtype:             string | null
  status:              'pendente' | 'concluido' | 'cancelado'
  prioridade:          'baixa' | 'media' | 'alta'

  // Datas e horas (em formato ISO para o banco)
  data_inicio:         string        // yyyy-mm-dd
  hora_inicio:         string | null // HH:mm
  prazo_final:         string | null // yyyy-mm-dd
  published_at:        string | null // ISO timestamp

  // Relações (resolvidas na etapa de confirmação)
  process_number:      string | null
  processo_id:         string | null
  client_name:         string | null
  opposing_party_name: string | null
  cliente_id:          string | null
  responsible_name:    string | null
  responsible_user_id: string | null

  // Localização
  court:               string | null  // Tribunal
  county:              string | null  // Comarca

  // Rastreabilidade da fonte
  source:              'easyjur'
  source_event_id:     string | null

  // Payload original para auditoria
  raw_payload:         RawCsvRow
}

// ─── Preview ──────────────────────────────────────────────────────────────────

/** Linha como retornada no preview (inclui classificação e ID existente) */
export interface PreviewRow extends NormalizedAgendaRow {
  rowNumber:    number
  rowStatus:    ImportRowStatus
  errorMessage: string | null
  existingId:   string | null  // preenchido quando rowStatus = 'update'
}

/** Resumo de contagens do preview */
export interface PreviewSummary {
  total:       number
  newCount:    number
  updateCount: number
  skipCount:   number
  errorCount:  number
}

/** Resultado completo retornado pelo endpoint /api/agenda-import/preview */
export interface PreviewResult {
  rows:          PreviewRow[]
  summary:       PreviewSummary
  columnMapping: Record<string, string>  // { "Responsável": "responsible_name", ... }
  filename:      string
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

/** Linha de erro para o relatório de erros */
export interface ImportErrorRow {
  rowNumber: number
  error:     string
  raw:       RawCsvRow
}

/** Resultado retornado pelo endpoint /api/agenda-import/confirm */
export interface ConfirmResult {
  jobId:     string
  total:     number
  created:   number
  updated:   number
  skipped:   number
  errors:    number
  errorRows: ImportErrorRow[]
}
