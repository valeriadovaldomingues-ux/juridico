import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'
import type { KanbanStatus } from '@/types/kanban'

const ALLOWED: UserRole[] = ['gerente', 'socio']

interface PreviewRow {
  trello_card_id:   string | null
  titulo:           string
  status:           KanbanStatus
  prazo:            string | null
  last_activity:    string | null
  member_nome:      string | null
  numero_processo:  string | null
}

export interface ImportPreviewResult {
  total_csv:           number    // linhas válidas enviadas (já filtradas no cliente)
  rejeitados:          number    // antes do cutoff (já filtrados no cliente, apenas contagem)
  novas:               number    // serão inseridas
  duplicatas:          number    // (titulo+prazo) já existe → serão ignoradas
  atualizacoes:        number    // (numero_processo ou card_id) já existe → serão atualizadas
  sem_responsavel:     number    // member_nome não encontrado no sistema
  sem_responsavel_nomes: string[]
  perfis_disponiveis:  string[]  // perfis ativos para referência
}

export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const rows: PreviewRow[]    = body.rows
  const rejeitados: number    = body.rejected_count ?? 0

  const supabase = await createClient()

  // Carrega profiles ativos
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome')
    .eq('ativo', true)

  const profileIndex: Record<string, string> = {}
  for (const p of profiles ?? []) {
    profileIndex[normalizeName(p.nome)] = p.id
  }
  const perfis_disponiveis = (profiles ?? []).map(p => p.nome)

  // Carrega chaves de deduplicação existentes
  const { data: existing } = await supabase
    .from('kanban_tasks')
    .select('titulo, data, numero_processo, origem_id')

  const existingKeys    = new Set<string>()
  const existingNums    = new Set<string>()
  const existingCardIds = new Set<string>()

  for (const t of existing ?? []) {
    existingKeys.add(dedupeKey(t.titulo, t.data))
    if (t.numero_processo) existingNums.add(t.numero_processo.trim())
    if (t.origem_id)       existingCardIds.add(t.origem_id)
  }

  // Analisa cada linha
  let novas         = 0
  let duplicatas    = 0
  let atualizacoes  = 0
  let sem_responsavel = 0
  const semRespNomes = new Set<string>()

  for (const row of rows) {
    const titulo = row.titulo.trim()
    if (!titulo) continue

    // Verifica responsável
    if (row.member_nome) {
      const found = profileIndex[normalizeName(row.member_nome)]
      if (!found) {
        sem_responsavel++
        semRespNomes.add(row.member_nome)
      }
    }

    // Classificação: atualização > duplicata > nova
    const isCardIdMatch = row.trello_card_id && existingCardIds.has(row.trello_card_id)
    const isNumMatch    = row.numero_processo && existingNums.has(row.numero_processo.trim())

    if (isCardIdMatch || isNumMatch) {
      atualizacoes++
    } else if (existingKeys.has(dedupeKey(titulo, row.prazo))) {
      duplicatas++
    } else {
      novas++
    }
  }

  return NextResponse.json<ImportPreviewResult>({
    total_csv:             rows.length,
    rejeitados,
    novas,
    duplicatas,
    atualizacoes,
    sem_responsavel,
    sem_responsavel_nomes: [...semRespNomes],
    perfis_disponiveis,
  })
}

function normalizeName(nome: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

function dedupeKey(titulo: string, prazo: string | null | undefined): string {
  return `${titulo.toLowerCase().trim()}|${prazo ?? '__sem_prazo__'}`
}
