import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { mapComunicacaoDbRowToDraft } from '@/lib/comunicacao-inteligente'
import type { UserRole } from '@/types'

const ALLOWED_ROLES: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

async function registrarLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comunicacaoId: string,
  acao: 'gerada' | 'editada' | 'aprovada' | 'enviada' | 'descartada',
  realizadoPor: string,
  detalhes: Record<string, unknown>,
) {
  await supabase.from('comunicacoes_inteligentes_logs').insert({
    comunicacao_id: comunicacaoId,
    acao,
    detalhes,
    realizado_por: realizadoPor,
  })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ comunicacaoId: string }> },
) {
  const auth = await apiGuard(ALLOWED_ROLES)
  if (auth instanceof NextResponse) return auth

  const { comunicacaoId } = await params
  if (!comunicacaoId) {
    return NextResponse.json({ error: 'ID da comunicação ausente' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: current, error: findError } = await supabase
    .from('comunicacoes_inteligentes')
    .select('id, status, canal_destino')
    .eq('id', comunicacaoId)
    .single()

  if (findError || !current) {
    return NextResponse.json({ error: 'Comunicação não encontrada' }, { status: 404 })
  }

  if (current.status === 'enviada' || current.status === 'descartada') {
    return NextResponse.json({ error: 'Comunicação não pode ser aprovada neste estado' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('comunicacoes_inteligentes')
    .update({
      status: 'aprovada',
      aprovado_por: auth.userId,
      aprovado_em: new Date().toISOString(),
      atualizado_por: auth.userId,
    })
    .eq('id', comunicacaoId)
    .select(`
      *,
      criado_por_profile:profiles!criado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      enviado_por_profile:profiles!enviado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao aprovar comunicação' }, { status: 400 })
  }

  await registrarLog(supabase, comunicacaoId, 'aprovada', auth.userId, {
    canal_destino: current.canal_destino,
  })

  return NextResponse.json(
    mapComunicacaoDbRowToDraft(data as Parameters<typeof mapComunicacaoDbRowToDraft>[0]),
  )
}
