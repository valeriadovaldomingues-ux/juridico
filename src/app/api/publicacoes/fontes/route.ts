import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']
const ADMINS:  UserRole[] = ['gerente', 'socio']

/** GET /api/publicacoes/fontes — lista todas as fontes */
export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('publicacao_fontes')
    .select('id, nome, codigo, tipo, descricao, ativo, created_at')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/publicacoes/fontes — cria nova fonte */
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ADMINS)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { nome, codigo, tipo, descricao, email_config } = body

  if (!nome || !codigo || !tipo) {
    return NextResponse.json({ error: 'nome, codigo e tipo são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('publicacao_fontes')
    .insert({ nome, codigo: codigo.toLowerCase(), tipo, descricao, email_config: email_config ?? null })
    .select('id, nome, codigo, tipo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** PATCH /api/publicacoes/fontes?id=... — atualiza fonte */
export async function PATCH(req: NextRequest) {
  const auth = await apiGuard(ADMINS)
  if (auth instanceof NextResponse) return auth

  const id   = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const body = await req.json()
  const supabase = await createClient()

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.nome        !== undefined) upd.nome        = body.nome
  if (body.descricao   !== undefined) upd.descricao   = body.descricao
  if (body.ativo       !== undefined) upd.ativo       = body.ativo
  if (body.email_config !== undefined) upd.email_config = body.email_config

  const { data, error } = await supabase
    .from('publicacao_fontes')
    .update(upd)
    .eq('id', id)
    .select('id, nome, codigo, tipo, ativo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
