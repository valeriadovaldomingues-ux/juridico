import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { calculateSimpleSLA } from '@/lib/kanban-sla'

interface TarefaEntrada { titulo: string; descricao?: string | null; prazo?: string | null; responsavel_id?: string | null }

const ISO = /^\d{4}-\d{2}-\d{2}$/

// POST — salva a reunião (ata) e cria um card no Kanban para cada tarefa confirmada.
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const titulo = String(body?.titulo ?? '').trim()
  const dataReuniao = String(body?.data_reuniao ?? '')
  const ata = String(body?.ata ?? '').trim()
  const participantes = Array.isArray(body?.participantes) ? (body.participantes as unknown[]).map(p => String(p).trim()).filter(Boolean) : []
  const tarefas: TarefaEntrada[] = Array.isArray(body?.tarefas) ? body.tarefas : []

  if (!titulo) return NextResponse.json({ error: 'Dê um título à reunião.' }, { status: 400 })
  if (!ISO.test(dataReuniao)) return NextResponse.json({ error: 'Data da reunião inválida.' }, { status: 400 })
  if (!ata) return NextResponse.json({ error: 'A ata está vazia.' }, { status: 400 })

  const supabase = await createClient()
  const { data: reuniao, error } = await supabase
    .from('reunioes_pedv')
    .insert({ titulo, data_reuniao: dataReuniao, participantes, ata, criado_por: auth.userId })
    .select('id')
    .single()
  if (error || !reuniao) return NextResponse.json({ error: error?.message ?? 'Não foi possível salvar a reunião.' }, { status: 500 })

  const validas = tarefas
    .map(t => ({
      titulo: String(t.titulo ?? '').trim().slice(0, 140),
      descricao: String(t.descricao ?? '').trim() || null,
      prazo: t.prazo && ISO.test(t.prazo) ? t.prazo : null,
      responsavel_id: t.responsavel_id && isUUID(t.responsavel_id) ? t.responsavel_id : null,
    }))
    .filter(t => t.titulo)

  let criadas = 0
  if (validas.length > 0) {
    const { data: maxRow } = await supabase
      .from('kanban_tasks').select('ordem').eq('status', 'a_fazer').order('ordem', { ascending: false }).limit(1).maybeSingle()
    let ordem = (maxRow?.ordem ?? 0) + 1
    const origem = `Reunião PEDV: ${titulo} (${dataReuniao.split('-').reverse().join('/')})`
    const linhas = validas.map(t => {
      const sla = calculateSimpleSLA({ tipo: 'tarefa', origem: 'manual', data: t.prazo, status: 'a_fazer', prioridade: 'media' })
      return {
        titulo: t.titulo,
        descricao: [t.descricao, origem].filter(Boolean).join('\n\n'),
        tipo: 'tarefa', status: 'a_fazer', prioridade: 'media', origem: 'manual',
        responsavel_id: t.responsavel_id, data: t.prazo, reuniao_id: reuniao.id, criado_por: auth.userId,
        ordem: ordem++, sla_level: sla.sla_level, sla_due_at: sla.sla_due_at,
      }
    })
    const { data: inseridas, error: errTarefas } = await supabase.from('kanban_tasks').insert(linhas).select('id')
    if (errTarefas) {
      return NextResponse.json({ id: reuniao.id, tarefas_criadas: 0, aviso: `Reunião salva, mas os cards não foram criados: ${errTarefas.message}` }, { status: 201 })
    }
    criadas = inseridas?.length ?? 0
  }

  return NextResponse.json({ id: reuniao.id, tarefas_criadas: criadas }, { status: 201 })
}
