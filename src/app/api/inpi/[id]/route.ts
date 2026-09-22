import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const VIEW_ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']
const EDIT_ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

const SELECT = `*, cliente:clientes!cliente_id(id, nome, email, telefone, celular)`

// GET /api/inpi/[id] — detalhe com linha do tempo de movimentações
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(VIEW_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()

  const [processoRes, movRes] = await Promise.all([
    supabase.from('inpi_processos').select(SELECT).eq('id', id).single(),
    supabase.from('inpi_movimentacoes').select('*').eq('inpi_processo_id', id).order('rpi_data', { ascending: false }),
  ])

  if (processoRes.error) return NextResponse.json({ error: processoRes.error.message }, { status: 404 })
  return NextResponse.json({ ...processoRes.data, movimentacoes: movRes.data ?? [] })
}

// PATCH /api/inpi/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(EDIT_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const supabase = await createClient()

  const allowed_fields = [
    'cliente_id', 'numero_processo', 'tipo', 'titulo', 'natureza', 'classe_nice',
    'procurador', 'status', 'data_deposito', 'data_concessao', 'observacoes',
  ]
  const updates: Record<string, unknown> = {}
  for (const field of allowed_fields) {
    if (field in body) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('inpi_processos')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Já existe um processo INPI com esse número.' : error.message
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/inpi/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'] as UserRole[])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('inpi_processos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
