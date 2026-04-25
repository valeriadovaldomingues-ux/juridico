import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

// POST /api/comercial/propostas
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { lead_id, valor, descricao, tipo_contratacao = 'honorarios', data_envio } = body

  if (!lead_id) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })
  if (!valor || isNaN(Number(valor))) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('propostas_comerciais')
    .insert({
      lead_id,
      valor:            Number(valor),
      descricao:        descricao?.trim() || null,
      tipo_contratacao,
      data_envio:       data_envio || null,
      status:           data_envio ? 'enviada' : 'em_elaboracao',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se enviada, atualizar status do lead para proposta_enviada
  if (data_envio) {
    const { data: lead } = await supabase
      .from('leads')
      .select('status')
      .eq('id', lead_id)
      .single()

    if (lead && !['proposta_enviada', 'negociacao', 'fechado'].includes(lead.status)) {
      await supabase
        .from('leads')
        .update({ status: 'proposta_enviada', updated_at: new Date().toISOString() })
        .eq('id', lead_id)
    }
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/comercial/propostas — atualiza status da proposta
export async function PATCH(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { id, status, data_envio } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = await createClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (data_envio) updates.data_envio = data_envio

  const { data, error } = await supabase
    .from('propostas_comerciais')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sincronizar status do lead se proposta aceita ou recusada
  if (status === 'aceita') {
    await supabase
      .from('leads')
      .update({ status: 'negociacao', updated_at: new Date().toISOString() })
      .eq('id', data.lead_id)
      .not('status', 'in', '(fechado,perdido)')
  }

  return NextResponse.json(data)
}
