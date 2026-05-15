import { createClient }      from '@/lib/supabase/server'
import Link                   from 'next/link'
import { Scale, ArrowRight }  from 'lucide-react'
import EmptyState              from '../_components/EmptyState'
import ProcessStatusBadge      from '../_components/ProcessStatusBadge'
import FilterTabs, { type FilterOption } from '../_components/FilterTabs'
import Pagination              from '../_components/Pagination'

const PAGE_SIZE = 20

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PortalProcessosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : 'todos'
  const page   = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: pc } = await supabase
    .from('portal_clientes')
    .select('cliente_id')
    .eq('auth_user_id', user.id)
    .eq('ativo', true)
    .single()

  if (!pc) return null

  // ── Queries: todos os processos (para contagens) + página atual ─────────
  const [
    { data: todos },
    { data: processos, count: totalCount },
  ] = await Promise.all([
    // Todos os processos — só para contar por status (sem campos extras)
    supabase.from('processos')
      .select('id, status')
      .eq('cliente_id', pc.cliente_id)
      .eq('visivel_cliente', true),

    // Processos da página atual com filtro aplicado
    (() => {
      let q = supabase.from('processos')
        .select('id, numero_processo, titulo, area_direito, status, tribunal, created_at', { count: 'exact' })
        .eq('cliente_id', pc.cliente_id)
        .eq('visivel_cliente', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (status !== 'todos') q = q.eq('status', status)
      return q
    })(),
  ])

  // Contagens por status para os badges dos filtros
  const contagens = (todos ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})
  const total = todos?.length ?? 0

  const STATUS_OPTIONS: FilterOption[] = [
    { label: 'Todos',     value: 'todos',     count: total },
    { label: 'Ativos',    value: 'ativo',     count: contagens.ativo      ?? 0 },
    { label: 'Suspensos', value: 'suspenso',  count: contagens.suspenso   ?? 0 },
    { label: 'Encerrados',value: 'encerrado', count: contagens.encerrado  ?? 0 },
    { label: 'Arquivados',value: 'arquivado', count: contagens.arquivado  ?? 0 },
  ].filter(o => o.value === 'todos' || (o.count ?? 0) > 0)

  const extraParams: Record<string, string> = status !== 'todos' ? { status } : {}

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
          <h1
            className="text-[28px] text-[#1C1C2E] leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
          >
            Meus Processos
          </h1>
        </div>
        <span className="text-[11px] text-[#9CA3AF] tracking-wide tabular-nums self-end pb-0.5">
          {total} {total === 1 ? 'processo' : 'processos'}
        </span>
      </div>

      {/* ── Filtros de status ──────────────────────────────────────────── */}
      {STATUS_OPTIONS.length > 1 && (
        <FilterTabs
          options={STATUS_OPTIONS}
          current={status}
          paramName="status"
          basePath="/portal/processos"
        />
      )}

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      {!processos?.length ? (
        <EmptyState
          icon={Scale}
          titulo={status === 'todos' ? 'Nenhum processo disponível' : `Nenhum processo ${AREA_LABELS[status] ?? status}`}
          descricao={status === 'todos'
            ? 'Os processos liberados pelo escritório aparecerão aqui.'
            : 'Tente outro filtro ou aguarde a atualização pelo escritório.'
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-[#E8E3D8] overflow-hidden divide-y divide-[#F5F2EE]">
            {processos.map(p => (
              <Link
                key={p.id}
                href={`/portal/processos/${p.id}`}
                className="relative flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-[#FDFAF7] transition-all duration-200 group overflow-hidden"
              >
                {/* Gold left border on hover */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#C49557] scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-200" />

                {/* Ícone */}
                <div className="w-9 h-9 border border-[#E8E3D8] group-hover:border-[#C49557]/30 flex items-center justify-center shrink-0 transition-colors duration-200">
                  <Scale size={14} className="text-[#C49557]" strokeWidth={1.5} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1C1C2E] truncate leading-snug">
                    {p.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {p.numero_processo && (
                      <span className="text-[10px] text-[#9CA3AF] font-mono tracking-wide">
                        {p.numero_processo}
                      </span>
                    )}
                    {p.numero_processo && <span className="text-[10px] text-[#DDD8D0]">·</span>}
                    <span className="text-[10px] text-[#9CA3AF]">
                      {AREA_LABELS[p.area_direito] ?? p.area_direito}
                    </span>
                    {p.tribunal && (
                      <>
                        <span className="text-[10px] text-[#DDD8D0] hidden sm:inline">·</span>
                        <span className="text-[10px] text-[#9CA3AF] hidden sm:inline">{p.tribunal}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status — escondido em mobile para não poluir */}
                <div className="hidden sm:block shrink-0">
                  <ProcessStatusBadge status={p.status} size="sm" />
                </div>

                <ArrowRight
                  size={13}
                  className="text-[#DDD8D0] group-hover:text-[#C49557] shrink-0 transition-colors duration-200"
                />
              </Link>
            ))}
          </div>

          {/* Paginação */}
          <Pagination
            page={page}
            total={totalCount ?? total}
            pageSize={PAGE_SIZE}
            basePath="/portal/processos"
            extraParams={extraParams}
          />
        </div>
      )}
    </div>
  )
}
