import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['advogado', 'gerente', 'socio']

/** GET /api/ia/pecas?processo_id=... — lista peças de um processo */
export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const processo_id = req.nextUrl.searchParams.get('processo_id')
  if (!processo_id) return NextResponse.json({ error: 'processo_id obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ia_pecas')
    .select('id, tipo_peca, tipo_peca_label, status, instrucoes, analise_estrategica, created_at, updated_at, gerado_por:profiles!gerado_por(nome), revisado_por:profiles!revisado_por(nome), revisao_comentario')
    .eq('processo_id', processo_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/ia/pecas — salva uma peça gerada */
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { processo_id, tipo_peca, tipo_peca_label, conteudo, instrucoes, analise_estrategica } = body

  if (!processo_id || !tipo_peca || !conteudo) {
    return NextResponse.json({ error: 'processo_id, tipo_peca e conteudo são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ia_pecas')
    .insert({
      processo_id,
      tipo_peca,
      tipo_peca_label: tipo_peca_label ?? tipo_peca,
      conteudo,
      instrucoes:          instrucoes  ?? null,
      analise_estrategica: analise_estrategica ?? null,
      status:              'rascunho',
      gerado_por:          auth.userId,
    })
    .select('id, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
