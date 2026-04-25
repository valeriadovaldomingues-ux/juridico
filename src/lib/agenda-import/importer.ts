// ─────────────────────────────────────────────────────────────────────────────
// src/lib/agenda-import/importer.ts
//
// Serviço de importação de agenda EasyJur.
// Expõe duas operações:
//   previewImport  — classifica as linhas sem gravar no banco
//   confirmImport  — executa o upsert e registra o job de importação
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PreviewRow,
  PreviewResult,
  PreviewSummary,
  ConfirmResult,
  ImportErrorRow,
  RawCsvRow,
} from '@/types/agenda-import'
import { parseCsv } from './csv-parser'
import { buildColumnMapping, normalizeRow } from './normalizer'
import { syncAgendaToKanban } from './sync-to-kanban'

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Coleta os source_event_ids não-nulos de uma lista de objetos do CSV */
function extractSourceIds(objects: RawCsvRow[], columnMapping: Record<string, string>): string[] {
  const idKey = Object.keys(columnMapping).find(k => columnMapping[k] === 'source_event_id')
  if (!idKey) return []
  return [...new Set(objects.map(o => (o[idKey] ?? '').trim()).filter(Boolean))]
}

/** Busca agenda_items existentes para deduplicação por source_event_id */
async function fetchExistingBySourceId(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase
    .from('agenda_items')
    .select('id, source_event_id')
    .eq('source', 'easyjur')
    .in('source_event_id', ids)
  return new Map((data ?? []).map((r: any) => [r.source_event_id as string, r.id as string]))
}

/** Busca processo_id por numero_processo */
async function fetchProcessoMap(
  supabase: SupabaseClient,
  numbers: string[],
): Promise<Map<string, string>> {
  if (numbers.length === 0) return new Map()
  const { data } = await supabase
    .from('processos')
    .select('id, numero_processo')
    .in('numero_processo', numbers)
  return new Map((data ?? []).map((p: any) => [p.numero_processo as string, p.id as string]))
}

/** Busca profile_id por nome */
async function fetchProfileMap(
  supabase: SupabaseClient,
  names: string[],
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map()
  const { data } = await supabase
    .from('profiles')
    .select('id, nome')
    .in('nome', names)
  return new Map((data ?? []).map((p: any) => [p.nome as string, p.id as string]))
}

// ─── Preview ──────────────────────────────────────────────────────────────────

/**
 * Analisa o CSV e classifica cada linha sem gravar no banco.
 *
 * Classificações:
 *   new       — novo evento
 *   update    — evento existente (mesmo source + source_event_id)
 *   duplicate — duplicata dentro do próprio arquivo
 *   error     — linha inválida (data ausente, etc.)
 */
export async function previewImport(
  fileText: string,
  filename: string,
  supabase: SupabaseClient,
): Promise<PreviewResult> {
  // parseCsv retorna objetos { header: valor } diretamente via PapaParse header:true
  const { headers, objects, totalDataRows } = parseCsv(fileText)
  const columnMapping = buildColumnMapping(headers)

  // ── Debug: mapeamento de colunas ────────────────────────────────────────────
  console.log('[agenda-import/preview] arquivo:', filename)
  console.log('[agenda-import/preview] total de linhas:', totalDataRows)
  console.log('[agenda-import/preview] colunas reconhecidas:', columnMapping)
  const unmapped = headers.filter(h => !columnMapping[h])
  if (unmapped.length > 0) {
    console.log('[agenda-import/preview] colunas NÃO mapeadas:', unmapped)
  }

  const sourceIds   = extractSourceIds(objects, columnMapping)
  const existingMap = await fetchExistingBySourceId(supabase, sourceIds)

  const seenInFile  = new Set<string>()
  const rows: PreviewRow[] = []
  const summary: PreviewSummary = {
    total: 0, newCount: 0, updateCount: 0, skipCount: 0, errorCount: 0,
  }

  for (let i = 0; i < objects.length; i++) {
    summary.total++
    const raw = objects[i]
    const { row, error } = normalizeRow(raw, columnMapping)

    if (error || !row.data_inicio) {
      summary.errorCount++
      rows.push({
        ...row,
        rowNumber:    i + 1,
        rowStatus:    'error',
        errorMessage: error ?? 'Data do evento ausente',
        existingId:   null,
      })
      continue
    }

    // Dedup intra-arquivo
    if (row.source_event_id && seenInFile.has(row.source_event_id)) {
      summary.skipCount++
      rows.push({ ...row, rowNumber: i + 1, rowStatus: 'duplicate', errorMessage: null, existingId: null })
      continue
    }
    if (row.source_event_id) seenInFile.add(row.source_event_id)

    // Checar banco
    if (row.source_event_id && existingMap.has(row.source_event_id)) {
      summary.updateCount++
      rows.push({
        ...row,
        rowNumber:    i + 1,
        rowStatus:    'update',
        errorMessage: null,
        existingId:   existingMap.get(row.source_event_id)!,
      })
      continue
    }

    summary.newCount++
    rows.push({ ...row, rowNumber: i + 1, rowStatus: 'new', errorMessage: null, existingId: null })
  }

  return { rows, summary, columnMapping, filename }
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

/**
 * Re-parseia o CSV, resolve relações e grava no banco.
 *
 * - UPDATE: source_event_id bate com registro existente
 * - INSERT: demais casos (violação de unique → skipped)
 * - Nunca aborta o processo inteiro por erro em uma linha
 * - Registra agenda_import_jobs + agenda_import_rows
 */
export async function confirmImport(
  fileText: string,
  filename: string,
  importedBy: string,
  supabase: SupabaseClient,
): Promise<ConfirmResult> {
  const { headers, objects } = parseCsv(fileText)
  const columnMapping = buildColumnMapping(headers)

  // ── Resolução em lote de relações ──────────────────────────────────────────

  const processNumberKey = Object.keys(columnMapping).find(k => columnMapping[k] === 'process_number')
  const responsavelKey   = Object.keys(columnMapping).find(k => columnMapping[k] === 'responsible_name')

  const processNumbers = [...new Set(
    objects.map(o => (processNumberKey ? (o[processNumberKey] ?? '').trim() : '')).filter(Boolean),
  )]
  const responsibleNames = [...new Set(
    objects.map(o => (responsavelKey ? (o[responsavelKey] ?? '').trim() : '')).filter(Boolean),
  )]

  const [processoMap, profileMap, existingMap] = await Promise.all([
    fetchProcessoMap(supabase, processNumbers),
    fetchProfileMap(supabase, responsibleNames),
    fetchExistingBySourceId(supabase, extractSourceIds(objects, columnMapping)),
  ])

  // ── Processamento linha a linha ────────────────────────────────────────────

  let created = 0, updated = 0, skipped = 0, errors = 0
  const errorRows: ImportErrorRow[] = []

  type RowLog = {
    rowNumber: number
    status: 'created' | 'updated' | 'skipped' | 'error'
    error: string | null
    raw: RawCsvRow
  }
  const rowLogs: RowLog[] = []

  const seenInFile = new Set<string>()
  const now        = new Date().toISOString()

  for (let i = 0; i < objects.length; i++) {
    const raw       = objects[i]
    const rowNumber = i + 1
    const { row, error } = normalizeRow(raw, columnMapping)

    if (error || !row.data_inicio) {
      errors++
      const msg = error ?? 'Data do evento ausente'
      errorRows.push({ rowNumber, error: msg, raw })
      rowLogs.push({ rowNumber, status: 'error', error: msg, raw })
      continue
    }

    // Dedup intra-arquivo
    if (row.source_event_id && seenInFile.has(row.source_event_id)) {
      skipped++
      rowLogs.push({ rowNumber, status: 'skipped', error: null, raw })
      continue
    }
    if (row.source_event_id) seenInFile.add(row.source_event_id)

    // Resolver relações
    if (row.process_number)   row.processo_id         = processoMap.get(row.process_number) ?? null
    if (row.responsible_name) row.responsible_user_id = profileMap.get(row.responsible_name) ?? null

    const record = {
      titulo:              row.titulo,
      descricao:           row.descricao,
      tipo:                row.tipo,
      subtype:             row.subtype,
      status:              row.status,
      prioridade:          row.prioridade,
      data_inicio:         row.data_inicio,
      hora_inicio:         row.hora_inicio,
      prazo_final:         row.prazo_final,
      published_at:        row.published_at,
      process_number:      row.process_number,
      processo_id:         row.processo_id,
      client_name:         row.client_name,
      opposing_party_name: row.opposing_party_name,
      responsible_name:    row.responsible_name,
      responsible_user_id: row.responsible_user_id,
      responsavel:         row.responsible_name,
      court:               row.court,
      county:              row.county,
      source:              'easyjur' as const,
      source_event_id:     row.source_event_id,
      imported_at:         now,
      updated_at:          now,
      raw_payload:         row.raw_payload,
    }

    try {
      if (row.source_event_id && existingMap.has(row.source_event_id)) {
        const agendaItemId = existingMap.get(row.source_event_id)!
        const { error: updateError } = await supabase
          .from('agenda_items')
          .update(record)
          .eq('id', agendaItemId)
        if (updateError) throw updateError
        updated++
        rowLogs.push({ rowNumber, status: 'updated', error: null, raw })
        // Sincroniza atualização com o kanban (não-bloqueante)
        syncAgendaToKanban(supabase, agendaItemId, row, 'update').catch(e =>
          console.error('[importer] sync update kanban falhou:', e),
        )
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('agenda_items')
          .insert(record)
          .select('id')
          .single()
        if (insertError) {
          if (insertError.code === '23505') {
            skipped++
            rowLogs.push({ rowNumber, status: 'skipped', error: null, raw })
          } else {
            throw insertError
          }
        } else {
          created++
          rowLogs.push({ rowNumber, status: 'created', error: null, raw })
          // Sincroniza nova task no kanban (não-bloqueante)
          syncAgendaToKanban(supabase, inserted.id, row, 'insert').catch(e =>
            console.error('[importer] sync insert kanban falhou:', e),
          )
        }
      }
    } catch (err: any) {
      errors++
      const msg = String(err?.message ?? err)
      errorRows.push({ rowNumber, error: msg, raw })
      rowLogs.push({ rowNumber, status: 'error', error: msg, raw })
    }
  }

  // ── Registrar job de importação ────────────────────────────────────────────

  const { data: job } = await supabase
    .from('agenda_import_jobs')
    .insert({
      source:            'easyjur',
      original_filename: filename,
      imported_by:       importedBy,
      total_rows:        objects.length,
      created_count:     created,
      updated_count:     updated,
      skipped_count:     skipped,
      error_count:       errors,
    })
    .select('id')
    .single()

  // ── Registrar logs por linha (lotes de 100) ────────────────────────────────

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
        })),
      )
    }
  }

  return {
    jobId:   job?.id ?? '',
    total:   objects.length,
    created,
    updated,
    skipped,
    errors,
    errorRows,
  }
}
