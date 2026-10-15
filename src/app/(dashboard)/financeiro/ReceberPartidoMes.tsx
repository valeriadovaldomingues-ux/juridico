'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { anoMes, resolverCelula, type RegistroMes } from '@/lib/financeiro/grade-mensal'
import type { ItemGrade } from './GradePagamentoView'

/** A Receber: clientes da Receita Partido que ainda não pagaram o mês escolhido (pendente ou vencido). */
export default function ReceberPartidoMes({ itens, mes }: { itens: ItemGrade[]; mes: string }) {
  const [registros, setRegistros] = useState<Record<string, RegistroMes>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const mesAtual = anoMes(new Date())
  const ano = mes.slice(0, 4)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    const res = await fetch(`/api/financeiro/grade-pagamento/meses?ano=${ano}`)
    const json = await res.json().catch(() => ({}))
    setCarregando(false)
    if (!res.ok) { setErro(json.error ?? 'Erro ao carregar'); return }
    const mapa: Record<string, RegistroMes> = {}
    for (const r of json.registros as RegistroMes[]) mapa[`${r.grade_id}|${r.mes.slice(0, 7)}`] = r
    setRegistros(mapa)
  }, [ano])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  const linhas = useMemo(() => itens
    .map(i => ({ item: i, c: resolverCelula(i.valor_mensal, registros[`${i.id}|${mes}`], mes, mesAtual) }))
    .filter(x => x.c.status === 'pendente' || x.c.status === 'vencido')
    .sort((a, b) => (a.item.cliente?.nome ?? '').localeCompare(b.item.cliente?.nome ?? '', 'pt-BR')),
  [itens, registros, mes, mesAtual])

  async function marcarPago(item: ItemGrade) {
    setSalvandoId(item.id)
    const res = await fetch('/api/financeiro/grade-pagamento/meses', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade_id: item.id, mes, status: 'pago' }),
    })
    setSalvandoId(null)
    if (res.ok) {
      const r = (await res.json()) as RegistroMes
      setRegistros(prev => ({ ...prev, [`${item.id}|${mes}`]: r }))
    } else setErro((await res.json().catch(() => ({}))).error ?? 'Não consegui salvar')
  }

  const total = linhas.reduce((a, x) => a + (x.c.valor ?? 0), 0)

  return (
    <div className="border-t border-[#f3f4f6]">
      <div className="flex items-center justify-between px-5 py-3 bg-[#fafbfb]">
        <p className="text-[12px] font-semibold text-[#374151]">Receita Partido — a receber neste mês</p>
        <p className="text-[12px] text-[#6b7280]">{linhas.length} cliente{linhas.length !== 1 ? 's' : ''} · <strong className="text-[#0f1923]">{formatCurrency(total)}</strong></p>
      </div>
      {erro && <p className="mx-5 mb-2 text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
      {carregando ? (
        <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-[#9ca3af]" /></div>
      ) : linhas.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12px] text-[#9ca3af]">Nada a receber da Receita Partido neste mês.</p>
      ) : (
        <ul>
          {linhas.map(({ item, c }) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-[#f9fafb] text-[13px]">
              <span className="flex-1 text-[#374151]">{item.cliente?.nome ?? '—'}</span>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', c.status === 'vencido' ? 'bg-[#fde8e8] text-[#a93226]' : 'bg-[#fef8ec] text-[#8a6000]')}>
                {c.status === 'vencido' ? 'Vencido' : 'Pendente'}
              </span>
              <span className="w-28 text-right tabular-nums text-[#0f1923]">{c.valor ? formatCurrency(c.valor) : '—'}</span>
              <button onClick={() => marcarPago(item)} disabled={salvandoId === item.id} title="Marcar como pago"
                className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-[#1a7a45] hover:bg-[#e6f4ee] disabled:opacity-50"><CheckCircle2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
