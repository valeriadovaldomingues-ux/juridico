import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

// POST /api/agenda-items
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const {
    titulo,
    descricao,
    tipo = 'evento',
    status = 'pendente',
    prioridade = 'media',
    data_inicio,
    hora_inicio,
    data_fim,
    hora_fim,
    prazo_final,
    processo_id,
    cliente_id,
    responsavel,
  } = body

  if (!titulo?.trim()) {
    return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  }
  if (!data_inicio) {
    return NextResponse.json({ error: 'Data obrigatória' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('agenda_items')
    .insert({
      titulo:      titulo.trim(),
      descricao:   descricao?.trim() || null,
      tipo,
      status,
      prioridade,
      data_inicio,
      hora_inicio:  hora_inicio  || null,
      data_fim:     data_fim     || null,
      hora_fim:     hora_fim     || null,
      prazo_final:  prazo_final  || null,
      processo_id:  processo_id  || null,
      cliente_id:   cliente_id   || null,
      responsavel:  responsavel  || null,
    })
    .select('id, titulo, tipo, data_inicio, hora_inicio, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
