import { createClient } from '@/lib/supabase/server'
import { CalendarDays, Clock } from 'lucide-react'

const TIPO_LABELS: Record<string, string> = {
  tarefa: 'Tarefa', evento: 'Evento', prazo: 'Prazo', audiencia: 'Audiência',
  audiencia_processual: 'Audiência', prazo_processual: 'Prazo Processual',
  reuniao: 'Reunião', diligencia: 'Diligência', outro: 'Outro',
}

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa:   'bg-[#f3f4f6] text-[#7a8899]',
  media:   'bg-amber-50 text-amber-700',
  alta:    'bg-orange-50 text-orange-700',
  urgente: 'bg-red-50 text-red-700',
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

  // IDs dos processos visíveis do cliente
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
    ...(prazos ?? []).map(p => ({ ...p, _origem: 'prazo',  _data: p.data_final })),
  ].sort((a, b) => (a._data ?? '').localeCompare(b._data ?? ''))

  return (
    <div className="space-y-5">
      <h1 className="text-[20px] font-semibold text-[#0f1923]">Agenda e Prazos</h1>

      {itens.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D0DCDC] p-12 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <CalendarDays size={32} className="mx-auto text-[#D0DCDC] mb-3" />
          <p className="text-[13px] text-[#9ca3af]">Nenhum evento ou prazo próximo.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#D0DCDC] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {itens.map((item, i) => {
            const dataFormatada = item._data
              ? new Date(item._data + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })
              : '—'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const processo = (item as any).processo as { numero_processo: string | null; titulo: string } | null

            return (
              <div
                key={item.id + item._origem}
                className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? 'border-t border-[#f5f7fa]' : ''}`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#E8F0F0] flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarDays size={15} className="text-[#145A5B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0f1923]">{item.titulo}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORIDADE_COLORS[item.prioridade] ?? 'bg-[#f3f4f6] text-[#7a8899]'}`}>
                      {item.prioridade}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#9ca3af]">
                      {TIPO_LABELS[item.tipo] ?? item.tipo}
                    </span>
                    {processo && (
                      <span className="text-[11px] text-[#c5cdd8]">
                        {processo.numero_processo ?? processo.titulo}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[12px] font-medium text-[#374151]">{dataFormatada}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
