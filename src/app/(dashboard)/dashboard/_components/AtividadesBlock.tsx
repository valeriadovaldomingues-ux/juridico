'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

type Periodo = 'hoje' | 'semana' | 'mes'

interface PrazoResumido {
  id: string
  status: string
  data_final: string
}

export default function AtividadesBlock({ atividades }: { atividades: PrazoResumido[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('semana')

  const todayStr = new Date().toISOString().split('T')[0]
  const today    = new Date(todayStr + 'T12:00:00')

  let windowStart: string
  let windowEnd:   string

  if (periodo === 'hoje') {
    windowStart = todayStr
    windowEnd   = todayStr
  } else if (periodo === 'semana') {
    const day  = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon  = new Date(today); mon.setDate(today.getDate() + diff)
    const sun  = new Date(mon);   sun.setDate(mon.getDate() + 6)
    windowStart = mon.toISOString().split('T')[0]
    windowEnd   = sun.toISOString().split('T')[0]
  } else {
    windowStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    windowEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  }

  const atrasadas = atividades.filter(a => a.status === 'pendente' && a.data_final < todayStr)
  const aConcluir = atividades.filter(a =>
    a.status === 'pendente' && a.data_final >= todayStr && a.data_final <= windowEnd
  )
  const concluidas = atividades.filter(a =>
    a.status === 'concluido' && a.data_final >= windowStart && a.data_final <= windowEnd
  )

  const total      = atrasadas.length + aConcluir.length + concluidas.length
  const progressPct = total > 0 ? Math.round((concluidas.length / total) * 100) : 0

  const periodos: { key: Periodo; label: string }[] = [
    { key: 'hoje',   label: 'Hoje'   },
    { key: 'semana', label: 'Semana' },
    { key: 'mes',    label: 'Mês'    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm overflow-hidden flex flex-col">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-[#F0F4F4]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-[#0f1923]">Minhas Atividades</h2>
          <Link href="/agenda" className="text-[11px] text-[#b8903a] font-semibold hover:text-[#a07830] transition-colors">
            Ver todos →
          </Link>
        </div>

        {/* Segmented control */}
        <div className="flex bg-[#F7F9F9] rounded-xl p-[3px] border border-[#E8F0F0]">
          {periodos.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all duration-200 ${
                periodo === key
                  ? 'bg-[#0F3D3E] text-white shadow-sm'
                  : 'text-[#9aabb8] hover:text-[#4a5a6a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat rows */}
      <div className="px-6 py-5 space-y-3 flex-1">

        {/* Atrasadas */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-rose-50 rounded-xl border border-rose-100">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
              <AlertTriangle size={13} className="text-rose-600" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-rose-900 leading-none">Atrasadas</p>
              <p className="text-[10px] text-rose-400 mt-0.5">Vencimento expirado</p>
            </div>
          </div>
          <span className="text-[28px] font-black text-rose-700 leading-none">{atrasadas.length}</span>
        </div>

        {/* A concluir */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-amber-50 rounded-xl border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock size={13} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-amber-900 leading-none">A concluir</p>
              <p className="text-[10px] text-amber-400 mt-0.5">Dentro do período</p>
            </div>
          </div>
          <span className="text-[28px] font-black text-amber-700 leading-none">{aConcluir.length}</span>
        </div>

        {/* Concluídas */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={13} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-emerald-900 leading-none">Concluídas</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">No período selecionado</p>
            </div>
          </div>
          <span className="text-[28px] font-black text-emerald-700 leading-none">{concluidas.length}</span>
        </div>

        {/* Progress */}
        <div className="pt-2">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[11px] text-[#9aabb8]">Progresso</span>
            <span className="text-[13px] font-bold text-[#0f1923]">{progressPct}%</span>
          </div>
          <div className="h-2 bg-[#F7F9F9] rounded-full overflow-hidden border border-[#E8F0F0]">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-[#1B6E70] rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-[#9aabb8] mt-1.5">
            {concluidas.length} de {total} atividades concluídas
          </p>
        </div>
      </div>
    </div>
  )
}
