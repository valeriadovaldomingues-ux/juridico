import { createClient }  from '@/lib/supabase/server'
import { CalendarDays, AlertTriangle } from 'lucide-react'
import EmptyState  from '../_components/EmptyState'
import FilterTabs, { type FilterOption } from '../_components/FilterTabs'

const TIPO_LABELS: Record<string, string> = {
  tarefa: 'Tarefa', evento: 'Evento', prazo: 'Prazo', audiencia: 'Audiência',
  audiencia_processual: 'Audiência', prazo_processual: 'Prazo Processual',
  reuniao: 'Reunião', diligencia: 'Diligência', outro: 'Outro',
}

const PRIORIDADE: Record<string, { dot: string; label: string; text: string }> = {
  baixa:   { dot: 'bg-[#D1D5DB]', label: 'Baixa',   text: 'text-[#9CA3AF]'  },
  media:   { dot: 'bg-amber-400',  label: 'Média',   text: 'text-amber-700'  },
  alta:    { dot: 'bg-orange-400', label: 'Alta',    text: 'text-orange-700' },
  urgente: { dot: 'bg-red-500',    label: 'Urgente', text: 'text-red-700'    },
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
function parseData(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return { dia: String(d.getDate()).padStart(2,'0'), mes: MESES[d.getMonth()], ano: d.getFullYear() }
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PortalAgendaPage({ searchParams }: PageProps) {
  const params   = await searchParams
  const tipo     = typeof params.tipo === 'string' ? params.tipo : 'todos'
  const periodo  = typeof params.periodo === 'string' ? params.periodo : 'proximos'

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

  const hoje = new Date().toISOString().split('T')[0]
  const mostrarPassados = periodo === 'todos'

  const { data: processoIds } = await supabase
    .from('processos')
    .select('id')
    .eq('cliente_id', pc.cliente_id)
    .eq('visivel_cliente', true)

  const ids = (processoIds ?? []).map((p: { id: string }) => p.id)

  type AgendaItem   = Record<string, unknown>
  type PrazoItem    = Record<string, unknown>

  const [{ data: agenda }, { data: prazos }] = ids.length > 0
    ? await Promise.all([
        (() => {
          let q = supabase
            .from('agenda_items')
            .select('id, titulo, tipo, data_inicio, hora_inicio, prioridade, processo_id, processo:processos(numero_processo, titulo)')
            .in('processo_id', ids)
            .eq('visivel_cliente', true)
            .order('data_inicio', { ascending: !mostrarPassados })
            .limit(50)
          if (!mostrarPassados) q = q.gte('data_inicio', hoje)
          return q
        })(),
        (() => {
          if (tipo === 'audiencia') return Promise.resolve({ data: [] })
          let q = supabase
            .from('prazos')
            .select('id, titulo, tipo, data_final, prioridade, processo_id, processo:processos(numero_processo, titulo)')
            .in('processo_id', ids)
            .eq('visivel_cliente', true)
            .order('data_final', { ascending: !mostrarPassados })
            .limit(50)
          if (!mostrarPassados) q = q.eq('status', 'pendente').gte('data_final', hoje)
          return q
        })(),
      ])
    : [{ data: [] as AgendaItem[] }, { data: [] as PrazoItem[] }]

  const AUDIENCIA_TIPOS = ['audiencia', 'audiencia_processual']

  let itens: Array<AgendaItem & { _origem: string; _data: string }> = [
    ...(agenda ?? []).map((a: AgendaItem) => ({ ...a, _origem: 'agenda', _data: a.data_inicio as string })),
    ...(tipo !== 'audiencia' ? (prazos ?? []) : []).map((p: PrazoItem) => ({
      ...p, _origem: 'prazo', _data: p.data_final as string,
    })),
  ]

  // Filtro de tipo client-side (sobre dados já carregados)
  if (tipo === 'audiencia') {
    itens = itens.filter(i => AUDIENCIA_TIPOS.includes((i as Record<string, unknown>).tipo as string))
  } else if (tipo === 'prazos') {
    itens = itens.filter(i => i._origem === 'prazo')
  }

  itens.sort((a, b) => {
    const cmp = ((a._data as string) ?? '').localeCompare((b._data as string) ?? '')
    return mostrarPassados ? -cmp : cmp
  })

  const nAudiencias = itens.filter(i => AUDIENCIA_TIPOS.includes((i as Record<string, unknown>).tipo as string)).length
  const nPrazos     = itens.filter(i => i._origem === 'prazo').length

  const TIPO_OPTIONS: FilterOption[] = [
    { label: 'Todos',      value: 'todos',    count: itens.length },
    { label: 'Audiências', value: 'audiencia',count: nAudiencias  },
    { label: 'Prazos',     value: 'prazos',   count: nPrazos      },
  ].filter(o => o.value === 'todos' || (o.count ?? 0) > 0)

  const PERIODO_OPTIONS: FilterOption[] = [
    { label: 'Próximos', value: 'proximos' },
    { label: 'Histórico',value: 'todos'    },
  ]

  return (
    <div className="space-y-5">

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
          <h1
            className="text-[28px] text-[#1C1C2E] leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
          >
            Agenda e Prazos
          </h1>
        </div>
        {itens.length > 0 && (
          <span className="text-[11px] text-[#9CA3AF] tracking-wide tabular-nums self-end pb-0.5">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <FilterTabs
          options={TIPO_OPTIONS}
          current={tipo}
          paramName="tipo"
          basePath="/portal/agenda"
          extraParams={periodo !== 'proximos' ? { periodo } : {}}
        />
        <div className="w-px h-6 bg-[#E8E3D8] self-center hidden sm:block" />
        <FilterTabs
          options={PERIODO_OPTIONS}
          current={periodo}
          paramName="periodo"
          basePath="/portal/agenda"
          extraParams={tipo !== 'todos' ? { tipo } : {}}
        />
      </div>

      {/* Lista */}
      {itens.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          titulo={periodo === 'proximos' ? 'Nenhum evento próximo' : 'Nenhum evento registrado'}
          descricao={periodo === 'proximos'
            ? 'Audiências e prazos liberados pelo escritório aparecerão aqui.'
            : 'Tente outro filtro ou aguarde atualizações do escritório.'
          }
        />
      ) : (
        <div className="space-y-2.5">
          {itens.map(item => {
            const _data = item._data as string | undefined
            const { dia, mes, ano } = _data ? parseData(_data) : { dia: '—', mes: '', ano: 0 }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const processo  = (item as any).processo as { numero_processo: string | null; titulo: string } | null
            const prioridade = (item as Record<string, unknown>).prioridade as string
            const prio      = PRIORIDADE[prioridade] ?? PRIORIDADE.media
            const isUrgente = prioridade === 'urgente'
            const isPast    = _data ? _data < hoje : false

            return (
              <div
                key={String(item.id) + String(item._origem)}
                className={`bg-white border flex overflow-hidden transition-all duration-200 hover:shadow-sm ${
                  isPast    ? 'border-[#E8E3D8] opacity-60' :
                  isUrgente ? 'border-amber-200 hover:border-amber-300' :
                  'border-[#E8E3D8] hover:border-[#C49557]/25'
                }`}
              >
                {/* Data */}
                <div className={`w-[56px] sm:w-[60px] flex flex-col items-center justify-center py-4 border-r shrink-0 ${
                  isPast    ? 'bg-[#F9F9F9] border-[#F0EBE4]' :
                  isUrgente ? 'bg-amber-50 border-amber-100' :
                  'bg-[#FDFAF7] border-[#F0EBE4]'
                }`}>
                  <span
                    className={`text-[20px] sm:text-[22px] leading-none font-semibold tabular-nums ${
                      isPast ? 'text-[#9CA3AF]' : isUrgente ? 'text-amber-700' : 'text-[#1C1C2E]'
                    }`}
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {dia}
                  </span>
                  <span className={`text-[9px] tracking-widest uppercase mt-0.5 ${
                    isPast ? 'text-[#C5C0B8]' : isUrgente ? 'text-amber-600' : 'text-[#C49557]'
                  }`}>
                    {mes}
                  </span>
                  <span className="text-[9px] text-[#C5C0B8] mt-0.5">{ano}</span>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0 px-3 sm:px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium leading-snug ${isPast ? 'text-[#6B7280]' : 'text-[#1C1C2E]'}`}>
                        {item.titulo as string}
                      </p>
                      {processo && (
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide truncate">
                          {processo.numero_processo ?? processo.titulo}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                      <span className={`text-[9px] tracking-wider uppercase font-medium hidden sm:block ${prio.text}`}>
                        {prio.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[9px] text-[#9CA3AF] border border-[#E8E3D8] px-1.5 py-0.5 tracking-wide uppercase">
                      {TIPO_LABELS[item.tipo as string] ?? item.tipo}
                    </span>
                    {isPast && (
                      <span className="text-[9px] text-[#C5C0B8] italic">Passado</span>
                    )}
                    {isUrgente && !isPast && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                        <AlertTriangle size={10} /> Urgente
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
