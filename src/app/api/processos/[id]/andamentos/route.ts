import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import {
  andamentoTipoPermitidoParaRole,
  normalizeAndamentoOrigem,
  normalizeAndamentoTipo,
} from '@/lib/processos/andamentos'

const ALLOWED_ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const

function parseDataAndamento(value?: string | null) {
  if (!value) return new Date()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID do processo ausente' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('processo_andamentos')
    .select(`
      *,
      responsavel:profiles(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .eq('processo_id', id)
    .order('data_andamento', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID do processo ausente' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const titulo = String((body as { titulo?: string }).titulo ?? '').trim()
  if (!titulo) {
    return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  }

  const tipo = normalizeAndamentoTipo((body as { tipo?: string }).tipo ?? null)
  if (!andamentoTipoPermitidoParaRole(auth.role, tipo)) {
    return NextResponse.json({ error: 'Sem permissão para este tipo de andamento' }, { status: 403 })
  }

  const dataAndamento = parseDataAndamento((body as { data_andamento?: string }).data_andamento ?? null)
  if (!dataAndamento) {
    return NextResponse.json({ error: 'Data do andamento inválida' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('processo_andamentos')
    .insert({
      processo_id: id,
      data_andamento: dataAndamento.toISOString(),
      tipo,
      titulo,
      descricao: String((body as { descricao?: string }).descricao ?? '').trim() || null,
      origem: normalizeAndamentoOrigem((body as { origem?: string }).origem ?? null),
      responsavel_id: String((body as { responsavel_id?: string }).responsavel_id ?? '').trim() || null,
      criado_por: auth.userId,
    })
    .select(`
      *,
      responsavel:profiles(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao criar andamento' }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
