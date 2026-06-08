import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { canViewRelatorio } from '@/lib/relatorios-inteligentes/permissions'
import { gerarRelatorioPdfBytes } from '@/lib/relatorios-inteligentes/pdf'
import { mapRelatorioDbRowToDraft } from '@/lib/relatorios-inteligentes/service'
import type { RelatorioClienteDraft } from '@/lib/relatorios-inteligentes'
import type { UserRole } from '@/types'

export const runtime = 'nodejs'

type ProfileLite = {
  id: string
  nome: string
  role: UserRole
  ativo: boolean
}

function slugifyFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'relatorio'
}

async function resolveAccessContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, role, ativo')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && profile.ativo && profile.role && profile.role !== 'cliente') {
    return {
      kind: 'internal' as const,
      userId: user.id,
      profile: profile as ProfileLite,
    }
  }

  const { data: portalCliente } = await supabase
    .from('portal_clientes')
    .select('cliente_id, ativo')
    .eq('auth_user_id', user.id)
    .eq('ativo', true)
    .maybeSingle()

  if (portalCliente) {
    return {
      kind: 'cliente' as const,
      userId: user.id,
      clienteId: portalCliente.cliente_id as string,
    }
  }

  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ relatorioId: string }> },
) {
  const { relatorioId } = await params
  if (!relatorioId || !isUUID(relatorioId)) {
    return NextResponse.json({ error: 'ID do relatório ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const access = await resolveAccessContext(supabase)
  if (!access) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let query = supabase
    .from('client_reports')
    .select(`
      *,
      cliente:clientes(id, nome),
      processo:processos(id, titulo, numero_processo),
      gerado_por_profile:profiles!gerado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      publicado_por_profile:profiles!publicado_por(id, nome, email, role)
    `)
    .eq('id', relatorioId)

  if (access.kind === 'cliente') {
    query = query
      .eq('cliente_id', access.clienteId)
      .eq('status', 'publicado')
  } else if (!canViewRelatorio(access.profile.role)) {
    return NextResponse.json({ error: 'Sem permissão para visualizar este relatório' }, { status: 403 })
  }

  const { data, error } = await query.single()
  if (error || !data) {
    return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  const relatorio = mapRelatorioDbRowToDraft(data as Parameters<typeof mapRelatorioDbRowToDraft>[0]) as RelatorioClienteDraft & {
    cliente?: { id: string; nome: string } | null
    processo?: { id: string; titulo: string; numero_processo: string | null } | null
  }

  const bytes = await gerarRelatorioPdfBytes(relatorio, {
    clienteNome: relatorio.cliente?.nome ?? 'Cliente',
    processoTitulo: relatorio.processo?.titulo ?? relatorio.titulo,
  })

  const filename = slugifyFilename(relatorio.titulo || 'relatorio')

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
