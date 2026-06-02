import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { normalizeAndamentoOrigem, normalizeAndamentoTipo } from '@/lib/processos/andamentos'

function parseDataAndamento(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ andamentoId: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { andamentoId } = await params
  if (!andamentoId) {
    return NextResponse.json({ error: 'ID do andamento ausente' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const titulo = String((body as { titulo?: string }).titulo ?? '').trim()
  if (!titulo) {
    return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  }

  const dataAndamento = parseDataAndamento((body as { data_andamento?: string }).data_andamento ?? null)
  if (!dataAndamento) {
    return NextResponse.json({ error: 'Data do andamento inválida' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('processo_andamentos')
    .update({
      data_andamento: dataAndamento.toISOString(),
      tipo: normalizeAndamentoTipo((body as { tipo?: string }).tipo ?? null),
      titulo,
      descricao: String((body as { descricao?: string }).descricao ?? '').trim() || null,
      origem: normalizeAndamentoOrigem((body as { origem?: string }).origem ?? null),
      responsavel_id: String((body as { responsavel_id?: string }).responsavel_id ?? '').trim() || null,
    })
    .eq('id', andamentoId)
    .select(`
      *,
      responsavel:profiles(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao atualizar andamento' }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ andamentoId: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { andamentoId } = await params
  if (!andamentoId) {
    return NextResponse.json({ error: 'ID do andamento ausente' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('processo_andamentos')
    .delete()
    .eq('id', andamentoId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
