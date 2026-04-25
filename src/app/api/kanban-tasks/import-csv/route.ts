import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { calculateSimpleSLA } from '@/lib/kanban-sla'
import type { UserRole } from '@/types'
import type { KanbanStatus } from '@/types/kanban'

const ALLOWED: UserRole[] = ['gerente', 'socio']

interface ImportRow {
  trello_card_id:   string | null
  titulo:           string
  descricao:        string | null
  status:           KanbanStatus
  prazo:            string | null
  last_activity:    string | null
  member_nome:      string | null
  numero_processo:  string | null
  partes_resumidas: string | null
  area_juridica:    string | null
  labels:           string | null
}

export interface ImportResult {
  importados:     number
  atualizados:    number
  ignorados:      number
  erros:          number
  import_batch_id: string
  detalhes:       string[]
}

/**
 * POST /api/kanban-tasks/import-csv
 *
 * Importação segura de CSV do Trello com:
 *  - lookup de responsável por nome (sem fallback automático)
 *  - deduplicação por card ID, número do processo e (titulo, prazo)
 *  - upsert: atualiza tarefas existentes por numero_processo ou card ID
 *  - registra lote em kanban_import_logs
 *  - historico de criação/atualização
 */
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'Corpo inválido: esperado { rows, import_batch_id }' }, { status: 400 })
  }

  const rows: ImportRow[]       = body.rows
  const import_batch_id: string = body.import_batch_id ?? crypto.randomUUID()
  const arquivo_nome: string    = body.arquivo_nome ?? 'desconhecido'
  const rejected_count: number  = body.rejected_count ?? 0

  if (rows.length === 0) {
    return NextResponse.json<ImportResult>({
      importados: 0, atualizados: 0, ignorados: 0, erros: 0,
      import_batch_id, detalhes: ['Nenhuma linha válida enviada.'],
    })
  }

  if (rows.length > 1000) {
    return NextResponse.json({ error: 'Limite de 1000 linhas por importação.' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── 1. Carregar profiles para lookup nome → id ──────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome')
    .eq('ativo', true)

  const profileIndex: Record<string, string> = {}
  for (const p of profiles ?? []) {
    profileIndex[normalizeName(p.nome)] = p.id
  }

  // ── 2. Carregar dados existentes para deduplicação ──────────────────────────
  const { data: existing } = await supabase
    .from('kanban_tasks')
    .select('id, titulo, data, numero_processo, origem_id, status')

  const existingByKey    = new Map<string, { id: string; status: string }>()
  const existingByNum    = new Map<string, { id: string; status: string }>()
  const existingByCardId = new Map<string, { id: string; status: string }>()

  for (const t of existing ?? []) {
    existingByKey.set(dedupeKey(t.titulo, t.data), { id: t.id, status: t.status })
    if (t.numero_processo?.trim()) existingByNum.set(t.numero_processo.trim(), { id: t.id, status: t.status })
    if (t.origem_id)               existingByCardId.set(t.origem_id, { id: t.id, status: t.status })
  }

  // ── 3. Pré-calcula próxima ordem por status ─────────────────────────────────
  const ordemMap: Partial<Record<KanbanStatus, number>> = {}
  for (const status of ['a_fazer', 'fazendo', 'com_pendencia', 'concluido'] as KanbanStatus[]) {
    const { data: maxRow } = await supabase
      .from('kanban_tasks')
      .select('ordem')
      .eq('status', status)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    ordemMap[status] = (maxRow?.ordem ?? -1) + 1
  }

  // ── 4. Processar linhas ─────────────────────────────────────────────────────
  const toInsert:  object[]                       = []
  const toUpdate:  Array<{ id: string; data: object }> = []
  const detalhes:  string[]                       = []
  const seenKeys   = new Set<string>()
  let ignorados    = 0
  let erros        = 0
  const now        = new Date().toISOString()

  for (const row of rows) {
    const titulo = row.titulo.trim()
    if (!titulo) { erros++; continue }

    // Lookup de responsável — sem fallback automático
    const responsavel_id = row.member_nome
      ? (profileIndex[normalizeName(row.member_nome)] ?? null)
      : null

    if (row.member_nome && !responsavel_id) {
      detalhes.push(`Sem responsável: "${row.member_nome}" não encontrado — tarefa importada sem responsável.`)
    }

    const sla = calculateSimpleSLA({
      origem:     'manual',
      data:       row.prazo,
      status:     row.status,
      prioridade: 'media',
    })

    const taskData = {
      titulo,
      descricao:        row.descricao,
      status:           row.status,
      prioridade:       'media',
      origem:           'trello',
      origem_id:        row.trello_card_id,
      data:             row.prazo,
      responsavel_id,
      numero_processo:  row.numero_processo,
      partes_resumidas: row.partes_resumidas,
      area_juridica:    row.area_juridica,
      sla_level:        sla.sla_level,
      sla_due_at:       sla.sla_due_at,
      updated_at:       now,
    }

    // Prioridade de dedup: card ID > numero_processo > (titulo, prazo)
    const cardMatch = row.trello_card_id ? existingByCardId.get(row.trello_card_id) : undefined
    const numMatch  = row.numero_processo?.trim() ? existingByNum.get(row.numero_processo.trim()) : undefined
    const keyMatch  = existingByKey.get(dedupeKey(titulo, row.prazo))

    if (cardMatch || numMatch) {
      const existing = (cardMatch ?? numMatch)!
      // Não sobrescrever tarefas já concluídas
      if (existing.status === 'concluido') {
        ignorados++
        detalhes.push(`Ignorada (concluída): "${titulo}"`)
        continue
      }
      toUpdate.push({ id: existing.id, data: taskData })
    } else if (keyMatch) {
      ignorados++
      detalhes.push(`Ignorada (duplicata): "${titulo}"${row.prazo ? ` — prazo ${row.prazo}` : ''}`)
    } else {
      // Evitar duplicatas dentro do mesmo arquivo
      const fileKey = dedupeKey(titulo, row.prazo)
      if (seenKeys.has(fileKey)) {
        ignorados++
        continue
      }
      seenKeys.add(fileKey)

      const ordem = ordemMap[row.status] ?? 0
      ordemMap[row.status] = ordem + 1
      toInsert.push({ ...taskData, ordem })
    }
  }

  // ── 5. Inserção em lote ─────────────────────────────────────────────────────
  const CHUNK = 50
  let importados  = 0
  let atualizados = 0

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { data: inserted, error } = await supabase
      .from('kanban_tasks')
      .insert(chunk)
      .select('id, titulo, status, responsavel_id')

    if (error) {
      erros += chunk.length
      detalhes.push(`Erro no lote de inserção ${Math.floor(i / CHUNK) + 1}: ${error.message}`)
      continue
    }

    importados += inserted?.length ?? 0

    if (inserted?.length) {
      await supabase.from('kanban_historico').insert(
        inserted.map(t => ({
          task_id:             t.id,
          usuario_id:          auth.userId,
          acao:                'criacao',
          para_status:         t.status,
          para_responsavel_id: t.responsavel_id ?? null,
        }))
      )
    }
  }

  // ── 6. Atualização de registros existentes ──────────────────────────────────
  for (const { id, data } of toUpdate) {
    const { error } = await supabase
      .from('kanban_tasks')
      .update(data)
      .eq('id', id)

    if (error) {
      erros++
      detalhes.push(`Erro ao atualizar tarefa ${id}: ${error.message}`)
    } else {
      atualizados++
      await supabase.from('kanban_historico').insert({
        task_id:    id,
        usuario_id: auth.userId,
        acao:       'edicao',
      })
    }
  }

  // ── 7. Registrar log da importação ──────────────────────────────────────────
  await supabase.from('kanban_import_logs').insert({
    import_batch_id,
    usuario_id:    auth.userId,
    arquivo_nome,
    total_linhas:  rows.length,
    importados,
    atualizados,
    ignorados,
    rejeitados:    rejected_count,
    erros,
    detalhes:      detalhes.length ? detalhes : null,
  }).select()

  return NextResponse.json<ImportResult>({
    importados,
    atualizados,
    ignorados,
    erros,
    import_batch_id,
    detalhes,
  })
}

// ── GET /api/kanban-tasks/import-csv — não suportado ───────────────────────────
export async function GET() {
  return NextResponse.json({ error: 'Método não suportado. Use GET /api/kanban-import-logs.' }, { status: 405 })
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function normalizeName(nome: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

function dedupeKey(titulo: string, prazo: string | null | undefined): string {
  return `${titulo.toLowerCase().trim()}|${prazo ?? '__sem_prazo__'}`
}
