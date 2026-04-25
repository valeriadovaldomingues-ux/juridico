import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

// POST /api/comercial/atendimentos
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { lead_id, data, tipo = 'whatsapp', resumo, proxima_acao, responsavel_id } = body

  if (!lead_id) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })
  if (!resumo?.trim()) return NextResponse.json({ error: 'Resumo obrigatório' }, { status: 400 })

  const supabase = await createClient()

  const { data: atendimento, error } = await supabase
    .from('atendimentos_comerciais')
    .insert({
      lead_id,
      data:          data || new Date().toISOString().split('T')[0],
      tipo,
      resumo:        resumo.trim(),
      proxima_acao:  proxima_acao?.trim() || null,
      responsavel_id: responsavel_id || auth.userId,
    })
    .select(`*, responsavel:profiles!responsavel_id(id, nome)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Atualizar updated_at do lead
  await supabase
    .from('leads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', lead_id)

  return NextResponse.json(atendimento, { status: 201 })
}
