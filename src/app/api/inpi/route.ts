import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

// Mesmo escopo do módulo 'processos' — sincronizado com PERMISSIONS/ALLOWED_ROUTES
// em src/lib/permissions.ts.
const VIEW_ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']
const EDIT_ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

const SELECT = `*, cliente:clientes!cliente_id(id, nome, email, telefone, celular)`

// GET /api/inpi
export async function GET(req: NextRequest) {
  const auth = await apiGuard(VIEW_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const cliente_id = searchParams.get('cliente_id')

  let query = supabase.from('inpi_processos').select(SELECT).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (cliente_id) query = query.eq('cliente_id', cliente_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/inpi
export async function POST(req: NextRequest) {
  const auth = await apiGuard(EDIT_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { cliente_id, numero_processo, tipo, titulo, natureza, classe_nice, procurador, data_deposito, observacoes } = body

  const numero = numero_processo?.toString().trim()
  if (!numero) return NextResponse.json({ error: 'Número do processo é obrigatório.' }, { status: 400 })
  if (!titulo?.trim()) return NextResponse.json({ error: 'Título (marca) é obrigatório.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inpi_processos')
    .insert({
      cliente_id:      cliente_id || null,
      numero_processo: numero,
      tipo:            tipo === 'patente' ? 'patente' : 'marca',
      titulo:          titulo.trim(),
      natureza:        natureza?.trim() || null,
      classe_nice:     classe_nice?.trim() || null,
      procurador:      procurador?.trim() || null,
      data_deposito:   data_deposito || null,
      observacoes:     observacoes?.trim() || null,
      created_by:      auth.userId,
    })
    .select(SELECT)
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Já existe um processo INPI com esse número.' : error.message
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
