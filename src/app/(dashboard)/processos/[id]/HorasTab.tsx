'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Loader2, Plus, Trash2 } from 'lucide-react'
import { buildAgendaTimeEntrySummary, calculateEffectiveMinutes, formatDurationMinutes } from '@/lib/agenda-time-entries'
import type { AgendaTimeEntry, UserRole } from '@/types'

const dataBR = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))

type Entrada = AgendaTimeEntry & { criado_por_profile?: { nome?: string } | null }

/** Horas lançadas neste processo (timesheet). O botão de registrar abre o formulário no ProcessoDetail. */
export default function HorasTab({ processoId, role, recarregarKey, onRegistrar }: { processoId: string; role: UserRole; recarregarKey: number; onRegistrar: () => void }) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null)
  const [erro, setErro] = useState('')
  const [apagando, setApagando] = useState<string | null>(null)
  const podeRegistrar = role !== 'estagiario'

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/agenda-time-entries?processo_id=${processoId}`)
    const j = await res.json().catch(() => [])
    if (!res.ok) { setErro((j as { error?: string }).error ?? 'Não foi possível carregar as horas.'); setEntradas([]); return }
    setErro(''); setEntradas(j as Entrada[])
  }, [processoId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar, recarregarKey])

  const resumo = useMemo(() => buildAgendaTimeEntrySummary(entradas ?? []), [entradas])

  async function apagar(e: Entrada) {
    if (!confirm('Apagar este lançamento de horas?')) return
    setApagando(e.id)
    const res = await fetch(`/api/agenda-time-entries/${e.id}`, { method: 'DELETE' })
    setApagando(null)
    if (res.ok) setEntradas(prev => (prev ?? []).filter(x => x.id !== e.id))
    else setErro((await res.json().catch(() => ({}))).error ?? 'Não foi possível apagar.')
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-[13px] text-[#374151]">
          <span className="flex items-center gap-1.5 font-semibold text-[#0f1923]"><Clock3 size={14} /> {formatDurationMinutes(resumo.totalMinutes)} no total</span>
          <span className="text-[#6b7280]">{formatDurationMinutes(resumo.billableMinutes)} cobráveis · {resumo.entryCount} lançamento{resumo.entryCount !== 1 ? 's' : ''}</span>
        </div>
        {podeRegistrar && (
          <button onClick={onRegistrar} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#145A5B] text-white text-[12px] font-medium hover:bg-[#1B6E70] transition-colors">
            <Plus size={13} /> Registrar horas
          </button>
        )}
      </div>
      {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

      {entradas === null ? (
        <div className="py-10 flex justify-center"><Loader2 size={18} className="animate-spin text-[#9ca3af]" /></div>
      ) : entradas.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[#9ca3af]">Nenhuma hora lançada neste processo ainda.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[#a8b3c4] border-b border-[#f3f4f6]">
              <th className="py-2 pr-3 font-semibold">Data</th><th className="py-2 pr-3 font-semibold">Atividade</th>
              <th className="py-2 pr-3 font-semibold">Quem</th><th className="py-2 pr-3 font-semibold text-right">Tempo</th><th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {entradas.map(e => {
              const min = calculateEffectiveMinutes(e)
              return (
                <tr key={e.id} className="border-b border-[#f9fafb] text-[13px] text-[#374151] align-top">
                  <td className="py-2.5 pr-3 whitespace-nowrap">{dataBR(e.inicio_em)}</td>
                  <td className="py-2.5 pr-3">{e.descricao_atividade || e.agenda_item?.titulo}
                    {!e.cobravel && <span className="ml-2 text-[10px] font-semibold text-[#9ca3af] uppercase">não cobrável</span>}</td>
                  <td className="py-2.5 pr-3 text-[#6b7280]">{e.criado_por_profile?.nome ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-right font-medium tabular-nums">{formatDurationMinutes(min)}</td>
                  <td className="py-2.5">
                    {podeRegistrar && (
                      <button onClick={() => apagar(e)} disabled={apagando === e.id} title="Apagar lançamento" className="p-1 text-[#c5cdd8] hover:text-red-600 disabled:opacity-50"><Trash2 size={13} /></button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
