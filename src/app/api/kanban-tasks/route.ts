import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { calculateSimpleSLA } from '@/lib/kanban-sla'

const ALLOWED: import('@/types').UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

/** GET /api/kanban-tasks — lista todas as tarefas com perfis e processo */
export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kanban_tasks')
    .select(`
      *,
      responsavel:profiles!responsavel_id(id, nome, cor_kanban),
      processo:processos!processo_id(id, titulo, numero_processo)
    `)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/kanban-tasks — cria nova tarefa */
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const {
    titulo, descricao, status = 'a_fazer', prioridade = 'media',
    responsavel_id, processo_id, numero_processo, partes_resumidas,
    area_juridica, pendencia_motivo, publicacao_id,
    origem = 'manual',
    // aceita tanto 'data' (nome do campo KanbanTask) quanto 'prazo' (legado)
    data: dataField, prazo,
    tipo,
  } = body

  const prazoFinal: string | null = dataField ?? prazo ?? null

  if (!titulo?.trim()) {
    return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  // Próxima ordem dentro da coluna de status (sem filtrar por responsável)
  const { data: maxRow } = await supabase
    .from('kanban_tasks')
    .select('ordem')
    .eq('status', status)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ordem = maxRow ? maxRow.ordem + 1 : 0

  const now = new Date().toISOString()
  const sla = calculateSimpleSLA({ tipo, origem, data: prazoFinal, status, prioridade })

  const { data, error } = await supabase
    .from('kanban_tasks')
    .insert({
      titulo:           titulo.trim(),
      descricao:        descricao?.trim()        ?? null,
      tipo:             tipo                     ?? null,
      status,
      prioridade,
      responsavel_id:   responsavel_id           ?? null,
      processo_id:      processo_id              ?? null,
      numero_processo:  numero_processo?.trim()  ?? null,
      partes_resumidas: partes_resumidas?.trim() ?? null,
      area_juridica:    area_juridica            ?? null,
      pendencia_motivo: pendencia_motivo?.trim() ?? null,
      publicacao_id:    publicacao_id            ?? null,
      origem,
      data:             prazoFinal,
      ordem,
      sla_level:        sla.sla_level,
      sla_due_at:       sla.sla_due_at,
      updated_at:       now,
    })
    .select(`*, responsavel:profiles!responsavel_id(id, nome, cor_kanban), processo:processos!processo_id(id, titulo, numero_processo)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar criação no histórico
  await supabase.from('kanban_historico').insert({
    task_id:             data.id,
    usuario_id:          auth.userId,
    acao:                'criacao',
    para_status:         status,
    para_responsavel_id: responsavel_id ?? null,
  })

  return NextResponse.json(data, { status: 201 })
}
