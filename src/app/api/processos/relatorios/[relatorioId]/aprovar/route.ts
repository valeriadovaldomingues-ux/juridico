import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { buscarRelatorioCompleto, registrarLogRelatorio } from '@/lib/relatorios-inteligentes/api'
import { canApproveRelatorio } from '@/lib/relatorios-inteligentes/permissions'
import type { UserRole } from '@/types'

const APPROVE_ROLES: UserRole[] = ['gerente', 'socio']

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ relatorioId: string }> },
) {
  const auth = await apiGuard(APPROVE_ROLES)
  if (auth instanceof NextResponse) return auth

  if (!canApproveRelatorio(auth.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para aprovar relatórios' }, { status: 403 })
  }

  const { relatorioId } = await params
  if (!relatorioId || !isUUID(relatorioId)) {
    return NextResponse.json({ error: 'ID do relatório ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const current = await buscarRelatorioCompleto(supabase, relatorioId)
  if (!current) {
    return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  if (current.status !== 'pendente_aprovacao') {
    return NextResponse.json({ error: 'Somente relatórios pendentes podem ser aprovados' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('client_reports')
    .update({
      status: 'aprovado',
      aprovado_por: auth.userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', relatorioId)
    .select(`
      *,
      gerado_por_profile:profiles!gerado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      publicado_por_profile:profiles!publicado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao aprovar relatório' }, { status: 400 })
  }

  await registrarLogRelatorio(supabase, data.id, 'aprovado', auth.userId, {})

  return NextResponse.json(data)
}
