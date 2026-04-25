// ─────────────────────────────────────────────────────────────────────────────
// src/lib/xlsx-import/importer.ts
//
// Lógica de preview e importação de agenda EasyJur (.xlsx).
//
// previewXlsxImport  → classifica cada linha sem gravar no banco
// confirmXlsxImport  → executa upsert em calendar_events + registra logs
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  XlsxPreviewRow,
  XlsxPreviewResult,
  XlsxPreviewSummary,
  XlsxConfirmResult,
  XlsxImportErrorRow,
} from '@/types/xlsx-import'
import { parseXlsx } from './xlsx-parser'
import { mapRow }     from './mapper'

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Busca calendar_events existentes por source_event_id em lote */
async function fetchExistingMap(
  supabase:   SupabaseClient,
  sourceIds:  string[],
): Promise<Map<string, string>> {
  if (sourceIds.length === 0) return new Map()
  const { data } = await supabase
    .from('calendar_events')
    .select('id, source_event_id')
    .eq('source', 'easyjur')
    .in('source_event_id', sourceIds)
  return new Map((data ?? []).map((r: any) => [String(r.source_event_id), String(r.id)]))
}

/** Busca processo_internal_id por numero_processo em lote */
async function fetchProcessoMap(
  supabase: SupabaseClient,
  numbers:  string[],
): Promise<Map<string, string>> {
  if (numbers.length === 0) return new Map()
  const { data } = await supabase
    .from('processos')
    .select('id, numero_processo')
    .in('numero_processo', numbers)
  return new Map((data ?? []).map((p: any) => [String(p.numero_processo), String(p.id)]))
}

// ─── Preview ──────────────────────────────────────────────────────────────────

/**
 * Lê o xlsx, mapeia todas as linhas e classifica cada uma
 * como new / update / duplicate / error — SEM gravar no banco.
 */
export async function previewXlsxImport(
  buffer:   ArrayBuffer,
  filename: string,
  supabase: SupabaseClient,
): Promise<XlsxPreviewResult> {
  const { dataRows, rawArrays, totalRows, detectedType } = parseXlsx(buffer, filename)

  // Coleta todos os source_event_ids para checar duplicatas em lote
  const allSourceIds = dataRows
    .map((_, i) => (rawArrays[i][0] ?? '').trim())
    .filter(Boolean)

  const existingMap = await fetchExistingMap(supabase, allSourceIds)

  const seenInFile = new Set<string>()
  const rows: XlsxPreviewRow[] = []
  const summary: XlsxPreviewSummary = {
    total: 0, newCount: 0, updateCount: 0, skipCount: 0, errorCount: 0,
  }

  for (let i = 0; i < dataRows.length; i++) {
    summary.total++
    const { event, error } = mapRow(rawArrays[i], dataRows[i], filename)

    // ── Linha com erro de parsing ──────────────────────────────────────────────
    if (error || !event.event_date) {
      summary.errorCount++
      rows.push({
        ...event,
        rowNumber: i + 2,  // +2 porque linha 1 é cabeçalho
        rowStatus: 'error',
        errorMessage: error ?? 'Data do evento ausente',
        existingId: null,
      })
      continue
    }

    const sid = event.source_event_id

    // ── Duplicata intra-arquivo ────────────────────────────────────────────────
    if (sid && seenInFile.has(sid)) {
      summary.skipCount++
      rows.push({ ...event, rowNumber: i + 2, rowStatus: 'duplicate', errorMessage: null, existingId: null })
      continue
    }
    if (sid) seenInFile.add(sid)

    // ── Evento já existe no banco → atualização ────────────────────────────────
    if (sid && existingMap.has(sid)) {
      summary.updateCount++
      rows.push({ ...event, rowNumber: i + 2, rowStatus: 'update', errorMessage: null, existingId: existingMap.get(sid)! })
      continue
    }

    // ── Novo evento ────────────────────────────────────────────────────────────
    summary.newCount++
    rows.push({ ...event, rowNumber: i + 2, rowStatus: 'new', errorMessage: null, existingId: null })
  }

  return { rows, summary, filename, detectedType }
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

/**
 * Re-parseia o xlsx, resolve relações (processo interno) e executa o upsert
 * em calendar_events. Registra job de importação + logs por linha.
 * Nunca aborta a importação inteira por erro em uma única linha.
 */
export async function confirmXlsxImport(
  buffer:     ArrayBuffer,
  filename:   string,
  importedBy: string,
  supabase:   SupabaseClient,
): Promise<XlsxConfirmResult> {
  const { dataRows, rawArrays } = parseXlsx(buffer, filename)

  // ── Resolver relações em lote ─────────────────────────────────────────────
  const allSourceIds = dataRows.map((_, i) => (rawArrays[i][0] ?? '').trim()).filter(Boolean)
  const allProcessNumbers = [...new Set(
    rawArrays.map(row => {
      // Número do processo está na col 53 — limpa aspas
      const raw = (row[53] ?? '').trim().replace(/^"|"$/g, '').trim()
      return raw
    }).filter(Boolean)
  )]

  const [existingMap, processoMap] = await Promise.all([
    fetchExistingMap(supabase, allSourceIds),
    fetchProcessoMap(supabase, allProcessNumbers),
  ])

  // ── Processamento linha a linha ──────────────────────────────────────────
  let created = 0, updated = 0, skipped = 0, errors = 0
  const errorRows: XlsxImportErrorRow[] = []

  type RowLog = {
    rowNumber: number
    status: 'created' | 'updated' | 'skipped' | 'error'
    error: string | null
    raw: Record<string, string>
  }
  const rowLogs: RowLog[] = []

  const seenInFile = new Set<string>()
  const now        = new Date().toISOString()

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber  = i + 2  // +2 porque linha 1 é cabeçalho
    const rawObj     = dataRows[i]
    const { event, error } = mapRow(rawArrays[i], rawObj, filename)

    // ── Linha com erro ───────────────────────────────────────────────────────
    if (error || !event.event_date) {
      errors++
      const msg = error ?? 'Data do evento ausente'
      errorRows.push({ rowNumber, error: msg, raw: rawObj })
      rowLogs.push({ rowNumber, status: 'error', error: msg, raw: rawObj })
      continue
    }

    const sid = event.source_event_id

    // ── Duplicata intra-arquivo ──────────────────────────────────────────────
    if (sid && seenInFile.has(sid)) {
      skipped++
      rowLogs.push({ rowNumber, status: 'skipped', error: null, raw: rawObj })
      continue
    }
    if (sid) seenInFile.add(sid)

    // ── Resolver processo interno ────────────────────────────────────────────
    if (event.process_number) {
      event.process_internal_id = processoMap.get(event.process_number) ?? null
    }

    // ── Montar record para upsert ────────────────────────────────────────────
    const record = {
      source:              event.source,
      source_file:         event.source_file,
      source_event_id:     event.source_event_id,
      title:               event.title,
      description:         event.description,
      resolution:          event.resolution,
      event_type:          event.event_type,
      workflow_name:       event.workflow_name,
      status:              event.status,
      event_date:          event.event_date,
      deadline_date:       event.deadline_date,
      created_date:        event.created_date,
      publication_date:    event.publication_date,
      start_time:          event.start_time,
      end_time:            event.end_time,
      owner_name:          event.owner_name,
      assigned_name:       event.assigned_name,
      client_name:         event.client_name,
      client_id_external:  event.client_id_external,
      opposing_party_name: event.opposing_party_name,
      parties_info:        event.parties_info,
      process_id_external: event.process_id_external,
      process_number:      event.process_number,
      court:               event.court,
      county:              event.county,
      state:               event.state,
      court_branch:        event.court_branch,
      court_rite:          event.court_rite,
      judge_name:          event.judge_name,
      matter:              event.matter,
      procedural_role:     event.procedural_role,
      case_class:          event.case_class,
      case_value:          event.case_value,
      practice_area:       event.practice_area,
      current_phase:       event.current_phase,
      process_status:      event.process_status,
      distribution_date:   event.distribution_date,
      process_type:        event.process_type,
      process_internal_id: event.process_internal_id,
      raw_payload:         event.raw_payload,
      imported_at:         now,
    }

    try {
      if (sid && existingMap.has(sid)) {
        // ── UPDATE ─────────────────────────────────────────────────────────────
        const { error: updateErr } = await supabase
          .from('calendar_events')
          .update(record)
          .eq('id', existingMap.get(sid)!)

        if (updateErr) throw updateErr
        updated++
        rowLogs.push({ rowNumber, status: 'updated', error: null, raw: rawObj })
      } else {
        // ── INSERT ─────────────────────────────────────────────────────────────
        const { error: insertErr } = await supabase
          .from('calendar_events')
          .insert(record)

        if (insertErr) {
          // 23505 = unique_violation (duplicata de índice) → skip silencioso
          if (insertErr.code === '23505') {
            skipped++
            rowLogs.push({ rowNumber, status: 'skipped', error: null, raw: rawObj })
          } else {
            throw insertErr
          }
        } else {
          created++
          rowLogs.push({ rowNumber, status: 'created', error: null, raw: rawObj })
        }
      }
    } catch (err: any) {
      errors++
      const msg = String(err?.message ?? err)
      errorRows.push({ rowNumber, error: msg, raw: rawObj })
      rowLogs.push({ rowNumber, status: 'error', error: msg, raw: rawObj })
    }
  }

  // ── Criar job de importação ────────────────────────────────────────────────
  const { data: job } = await supabase
    .from('agenda_import_jobs')
    .insert({
      source:            'easyjur',
      original_filename: filename,
      imported_by:       importedBy,
      total_rows:        dataRows.length,
      created_count:     created,
      updated_count:     updated,
      skipped_count:     skipped,
      error_count:       errors,
    })
    .select('id')
    .single()

  // ── Registrar logs por linha em lotes de 100 ──────────────────────────────
  if (job?.id && rowLogs.length > 0) {
    const BATCH = 100
    for (let b = 0; b < rowLogs.length; b += BATCH) {
      await supabase.from('agenda_import_rows').insert(
        rowLogs.slice(b, b + BATCH).map(r => ({
          import_job_id: job.id,
          row_number:    r.rowNumber,
          raw_payload:   r.raw,
          status:        r.status,
          error_message: r.error,
        }))
      )
    }
  }

  return {
    jobId:   job?.id ?? '',
    total:   dataRows.length,
    created,
    updated,
    skipped,
    errors,
    errorRows,
  }
}
