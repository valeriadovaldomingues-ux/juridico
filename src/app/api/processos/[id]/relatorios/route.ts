import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import {
  buscarAndamentosParaRelatorio,
  buscarProcessoCompletoParaRelatorio,
  gerarRelatorioInteligenteDraft,
  mapRelatorioDbRowToDraft,
  registrarLogRelatorio,
} from '@/lib/relatorios-inteligentes'
import { canGenerateRelatorio, canViewRelatorio } from '@/lib/relatorios-inteligentes/permissions'
import type { UserRole } from '@/types'

const VIEW_ROLES: UserRole[] = ['estagiario', 'advogado', 'gerente', 'socio']
const GENERATE_ROLES: UserRole[] = ['advogado', 'gerente', 'socio']

function parseBoundary(value?: string | null, end = false) {
  if (!value) return null
  const normalized = new Date(end ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`)
  if (Number.isNaN(normalized.getTime())) return null
  return normalized.toISOString()
}

function parseAndamentoIds(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map(item => (typeof item === 'string' && isUUID(item) ? item : null))
    .filter(Boolean)
    .slice(0, 40) as string[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(VIEW_ROLES)
  if (auth instanceof NextResponse) return auth

  if (!canViewRelatorio(auth.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para visualizar relatórios' }, { status: 403 })
  }

  const { id } = await params
  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: 'ID do processo ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_reports')
    .select(`
      *,
      gerado_por_profile:profiles!gerado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      publicado_por_profile:profiles!publicado_por(id, nome, email, role)
    `)
    .eq('processo_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json((data ?? []).map(item => mapRelatorioDbRowToDraft(item as Parameters<typeof mapRelatorioDbRowToDraft>[0])))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(GENERATE_ROLES)
  if (auth instanceof NextResponse) return auth

  if (!canGenerateRelatorio(auth.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para gerar relatórios' }, { status: 403 })
  }

  const { id } = await params
  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: 'ID do processo ausente ou inválido' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const periodoInicio = parseBoundary((body as { periodo_inicio?: string; periodoInicio?: string }).periodo_inicio ?? (body as { periodoInicio?: string }).periodoInicio ?? null)
  const periodoFim = parseBoundary((body as { periodo_fim?: string; periodoFim?: string }).periodo_fim ?? (body as { periodoFim?: string }).periodoFim ?? null, true)

  if ((periodoInicio && !periodoFim) || (!periodoInicio && periodoFim)) {
    return NextResponse.json({ error: 'Informe período inicial e final ou deixe ambos vazios' }, { status: 400 })
  }

  if (periodoInicio && periodoFim && new Date(periodoInicio) > new Date(periodoFim)) {
    return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
  }

  const andamentoIds = parseAndamentoIds((body as { andamento_ids?: unknown; andamentoIds?: unknown }).andamento_ids ?? (body as { andamentoIds?: unknown }).andamentoIds)

  const supabase = await createClient()
  const processo = await buscarProcessoCompletoParaRelatorio(supabase, id)
  if (!processo) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  let andamentos
  try {
    andamentos = await buscarAndamentosParaRelatorio(supabase, id, {
      andamentoIds,
      periodoInicio,
      periodoFim,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar andamentos'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const consulta = {
    processoId: id,
    clienteId: processo.cliente_id,
    periodoInicio,
    periodoFim,
  }

  let draft
  try {
    draft = await gerarRelatorioInteligenteDraft(processo, andamentos, consulta)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar relatório'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const titulo = typeof (body as { titulo?: unknown }).titulo === 'string' && String((body as { titulo?: unknown }).titulo).trim()
    ? String((body as { titulo?: unknown }).titulo).trim()
    : draft.titulo

  const { data, error } = await supabase
    .from('client_reports')
    .insert({
      cliente_id: processo.cliente_id,
      processo_id: id,
      titulo,
      periodo_inicio: periodoInicio?.slice(0, 10) ?? null,
      periodo_fim: periodoFim?.slice(0, 10) ?? null,
      resumo_executivo: draft.resumo_executivo,
      conteudo: draft.conteudo,
      conteudo_texto: draft.conteudo_texto,
      status: draft.status,
      gerado_por: auth.userId,
    })
    .select(`
      *,
      gerado_por_profile:profiles!gerado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      publicado_por_profile:profiles!publicado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao criar relatório' }, { status: 400 })
  }

  await registrarLogRelatorio(supabase, data.id, 'gerado', auth.userId, {
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    andamento_ids: andamentoIds,
  })

  return NextResponse.json(mapRelatorioDbRowToDraft(data as Parameters<typeof mapRelatorioDbRowToDraft>[0]), { status: 201 })
}
