import { createClient } from '@/lib/supabase/server'
import { CalendarDays, AlertTriangle } from 'lucide-react'

const TIPO_LABELS: Record<string, string> = {
  tarefa: 'Tarefa', evento: 'Evento', prazo: 'Prazo', audiencia: 'Audiência',
  audiencia_processual: 'Audiência', prazo_processual: 'Prazo Processual',
  reuniao: 'Reunião', diligencia: 'Diligência', outro: 'Outro',
}

const PRIORIDADE_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  baixa:   { label: 'Baixa',   dot: 'bg-[#D1D5DB]', text: 'text-[#9CA3AF]' },
  media:   { label: 'Média',   dot: 'bg-amber-400',  text: 'text-amber-700' },
  alta:    { label: 'Alta',    dot: 'bg-orange-400', text: 'text-orange-700' },
  urgente: { label: 'Urgente', dot: 'bg-red-500',    text: 'text-red-700'   },
}

const MESES: Record<string, string> = {
  Jan: 'Jan', Feb: 'Fev', Mar: 'Mar', Apr: 'Abr', May: 'Mai', Jun: 'Jun',
  Jul: 'Jul', Aug: 'Ago', Sep: 'Set', Oct: 'Out', Nov: 'Nov', Dec: 'Dez',
}

function formatData(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const dia = String(d.getDate()).padStart(2, '0')
  const mesEn = d.toLocaleString('en', { month: 'short' })
  const mes = MESES[mesEn] ?? mesEn
  const ano = d.getFullYear()
  return { dia, mes, ano }
}

export default async function PortalAgendaPage() {
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

  const { data: processoIds } = await supabase
    .from('processos')
    .select('id')
    .eq('cliente_id', pc.cliente_id)
    .eq('visivel_cliente', true)

  const ids = (processoIds ?? []).map(p => p.id)

  const [{ data: agenda }, { data: prazos }] = ids.length > 0
    ? await Promise.all([
        supabase
          .from('agenda_items')
          .select('id, titulo, tipo, data_inicio, hora_inicio, prioridade, processo_id, processo:processos(numero_processo, titulo)')
          .in('processo_id', ids)
          .eq('visivel_cliente', true)
          .gte('data_inicio', hoje)
          .order('data_inicio', { ascending: true })
          .limit(30),
        supabase
          .from('prazos')
          .select('id, titulo, tipo, data_final, prioridade, processo_id, processo:processos(numero_processo, titulo)')
          .in('processo_id', ids)
          .eq('visivel_cliente', true)
          .eq('status', 'pendente')
          .gte('data_final', hoje)
          .order('data_final', { ascending: true })
          .limit(30),
      ])
    : [{ data: [] }, { data: [] }]

  const itens = [
    ...(agenda ?? []).map(a => ({ ...a, _origem: 'agenda', _data: a.data_inicio })),
    ...(prazos ?? []).map(p => ({ ...p, _origem: 'prazo',  _data: p.data_final  })),
  ].sort((a, b) => (a._data ?? '').localeCompare(b._data ?? ''))

  return (
    <div className="space-y-6">

      <div>
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
        <h1
          className="text-[28px] text-[#1C1C2E] leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
        >
          Agenda e Prazos
        </h1>
      </div>

      {itens.length === 0 ? (

        <div className="bg-white border border-[#E8E3D8] px-8 py-14 text-center">
          <CalendarDays size={28} className="mx-auto text-[#E8E3D8] mb-4" strokeWidth={1} />
          <p className="text-[13px] text-[#9CA3AF]">Nenhum evento ou prazo próximo.</p>
        </div>

      ) : (

        <div className="space-y-2">
          {itens.map(item => {
            const { dia, mes, ano } = item._data ? formatData(item._data) : { dia: '—', mes: '', ano: 0 }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const processo = (item as any).processo as { numero_processo: string | null; titulo: string } | null
            const prio = PRIORIDADE_CONFIG[item.prioridade] ?? PRIORIDADE_CONFIG.media
            const isUrgente = item.prioridade === 'urgente'

            return (
              <div
                key={item.id + item._origem}
                className={`bg-white border flex gap-0 overflow-hidden ${
                  isUrgente ? 'border-amber-200' : 'border-[#E8E3D8]'
                }`}
              >
                {/* Calendário data */}
                <div className={`w-16 flex-col items-center justify-center py-4 border-r flex shrink-0 ${
                  isUrgente ? 'bg-amber-50 border-amber-200' : 'bg-[#FDFAF7] border-[#F0EBE4]'
                }`}>
                  <span className={`text-[22px] leading-none font-semibold ${
                    isUrgente ? 'text-amber-700' : 'text-[#1C1C2E]'
                  }`}
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {dia}
                  </span>
                  <span className={`text-[9px] tracking-widest uppercase mt-0.5 ${
                    isUrgente ? 'text-amber-600' : 'text-[#C49557]'
                  }`}>
                    {mes}
                  </span>
                  <span className="text-[9px] text-[#C5C0B8] mt-0.5">{ano}</span>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1C1C2E] leading-snug">{item.titulo}</p>
                      {processo && (
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide">
                          {processo.numero_processo ?? processo.titulo}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                      <span className={`text-[9px] tracking-wider uppercase font-medium ${prio.text}`}>
                        {prio.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[9px] text-[#9CA3AF] border border-[#E8E3D8] px-1.5 py-0.5 tracking-wide uppercase">
                      {TIPO_LABELS[item.tipo] ?? item.tipo}
                    </span>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(item as any).hora_inicio && (
                      <span className="text-[10px] text-[#9CA3AF]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {String((item as any).hora_inicio).slice(0, 5)}h
                      </span>
                    )}
                    {isUrgente && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-700">
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
