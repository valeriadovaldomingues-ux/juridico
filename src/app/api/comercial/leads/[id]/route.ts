import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

// GET /api/comercial/leads/[id]  — detalhe com atendimentos e propostas
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()

  const [leadRes, atendRes, propRes] = await Promise.all([
    supabase
      .from('leads')
      .select(`*, responsavel:profiles!responsavel_id(id, nome, cor_kanban), cliente:clientes!cliente_id(id, nome)`)
      .eq('id', id)
      .single(),
    supabase
      .from('atendimentos_comerciais')
      .select(`*, responsavel:profiles!responsavel_id(id, nome)`)
      .eq('lead_id', id)
      .order('data', { ascending: false }),
    supabase
      .from('propostas_comerciais')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (leadRes.error) return NextResponse.json({ error: leadRes.error.message }, { status: 404 })

  return NextResponse.json({
    ...leadRes.data,
    atendimentos: atendRes.data ?? [],
    propostas:    propRes.data ?? [],
  })
}

// PATCH /api/comercial/leads/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const supabase = await createClient()

  // Se está convertendo para cliente
  if (body.converter_para_cliente) {
    const { nome, email, telefone } = body
    if (!nome?.trim()) {
      return NextResponse.json({ error: 'Nome do cliente obrigatório para conversão' }, { status: 400 })
    }

    // Criar cliente
    const { data: cliente, error: errCliente } = await supabase
      .from('clientes')
      .insert({ nome: nome.trim(), email: email?.trim() || null, telefone: telefone?.trim() || null })
      .select('id, nome')
      .single()

    if (errCliente) return NextResponse.json({ error: errCliente.message }, { status: 500 })

    // Atualizar lead
    const { data, error } = await supabase
      .from('leads')
      .update({
        status:        'fechado',
        cliente_id:    cliente.id,
        convertido_em: new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq('id', id)
      .select(`*, responsavel:profiles!responsavel_id(id, nome, cor_kanban), cliente:clientes!cliente_id(id, nome)`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lead: data, cliente })
  }

  // Atualização normal
  const allowed_fields = [
    'nome', 'telefone', 'email', 'origem', 'area_interesse', 'observacoes',
    'responsavel_id', 'status', 'ordem', 'valor_estimado',
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of allowed_fields) {
    if (field in body) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select(`*, responsavel:profiles!responsavel_id(id, nome, cor_kanban), cliente:clientes!cliente_id(id, nome)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/comercial/leads/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['gerente', 'socio'] as UserRole[])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
