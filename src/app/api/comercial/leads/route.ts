import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

// GET /api/comercial/leads
export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const responsavel_id = searchParams.get('responsavel_id')

  let query = supabase
    .from('leads')
    .select(`
      *,
      responsavel:profiles!responsavel_id(id, nome, cor_kanban),
      cliente:clientes!cliente_id(id, nome)
    `)
    .order('ordem')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (responsavel_id) query = query.eq('responsavel_id', responsavel_id)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/comercial/leads
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const {
    nome,
    telefone,
    email,
    origem = 'indicacao',
    area_interesse,
    observacoes,
    responsavel_id,
    valor_estimado,
  } = body

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  // Calcular ordem no final da coluna novo_lead
  const { data: maxRow } = await supabase
    .from('leads')
    .select('ordem')
    .eq('status', 'novo_lead')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ordem = maxRow ? maxRow.ordem + 1 : 0

  const { data, error } = await supabase
    .from('leads')
    .insert({
      nome:           nome.trim(),
      telefone:       telefone?.trim() || null,
      email:          email?.trim()    || null,
      origem,
      area_interesse: area_interesse?.trim() || null,
      observacoes:    observacoes?.trim()    || null,
      responsavel_id: responsavel_id         || null,
      valor_estimado: valor_estimado         || null,
      status:         'novo_lead',
      ordem,
    })
    .select(`*, responsavel:profiles!responsavel_id(id, nome, cor_kanban)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
