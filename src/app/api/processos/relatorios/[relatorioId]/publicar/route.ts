import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { buscarRelatorioCompleto, registrarLogRelatorio } from '@/lib/relatorios-inteligentes/api'
import { canPublishRelatorio } from '@/lib/relatorios-inteligentes/permissions'
import type { UserRole } from '@/types'

const PUBLISH_ROLES: UserRole[] = ['gerente', 'socio']

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ relatorioId: string }> },
) {
  const auth = await apiGuard(PUBLISH_ROLES)
  if (auth instanceof NextResponse) return auth

  if (!canPublishRelatorio(auth.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para publicar relatórios' }, { status: 403 })
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

  if (current.status !== 'aprovado') {
    return NextResponse.json({ error: 'Somente relatórios aprovados podem ser publicados' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('client_reports')
    .update({
      status: 'publicado',
      publicado_por: auth.userId,
      published_at: new Date().toISOString(),
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
    return NextResponse.json({ error: error?.message ?? 'Erro ao publicar relatório' }, { status: 400 })
  }

  await registrarLogRelatorio(supabase, data.id, 'publicado', auth.userId, {})

  return NextResponse.json(data)
}
