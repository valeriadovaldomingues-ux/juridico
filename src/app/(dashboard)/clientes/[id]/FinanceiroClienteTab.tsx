'use client'

import { useMemo } from 'react'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatCompetencia } from '@/lib/honorarios/service'
import { HONORARIO_STATUS_LABELS } from '@/lib/honorarios/types'
import type { HonorarioMensal, HonorarioStatus } from '@/lib/honorarios/types'

const STATUS_COR: Record<HonorarioStatus, string> = {
  pago:      'bg-[#e6f4ee] text-[#1a7a45]',
  pendente:  'bg-[#fef8ec] text-[#8a6000]',
  parcial:   'bg-[#eaf1fb] text-[#1c4e9c]',
  em_atraso: 'bg-[#fde8e8] text-[#a93226]',
  isento:    'bg-[#F3F1EE] text-[#7a8899]',
}

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(a + 'T12:00:00').getTime() - new Date(b + 'T12:00:00').getTime()) / 86_400_000)
}

export default function FinanceiroClienteTab({
  clienteId, registros,
}: { clienteId: string; clienteNome: string; registros: HonorarioMensal[] }) {
  const resumo = useMemo(() => {
    const ativos = registros.filter(r => !r.cancelado)
    const hoje = new Date().toISOString().slice(0, 10)
    const recebido = ativos.reduce((s, r) => s + r.valor_pago, 0)
    const pendente = ativos.reduce((s, r) => s + Math.max(0, r.saldo_pendente), 0)
    const contratado = ativos.filter(r => r.status !== 'isento').reduce((s, r) => s + r.valor_devido, 0)

    const pagamentos = ativos.map(r => r.data_pagamento).filter(Boolean) as string[]
    const ultimoPagamento = pagamentos.length ? pagamentos.sort().at(-1)! : null

    const atrasos: number[] = []
    for (const r of ativos) {
      if (!r.vencimento) continue
      if (r.data_pagamento && r.data_pagamento > r.vencimento) atrasos.push(diasEntre(r.data_pagamento, r.vencimento))
      else if (r.status === 'em_atraso') atrasos.push(diasEntre(hoje, r.vencimento))
    }
    const mediaAtraso = atrasos.length ? Math.round(atrasos.reduce((s, d) => s + d, 0) / atrasos.length) : 0

    return { recebido, pendente, contratado, ultimoPagamento, mediaAtraso }
  }, [registros])

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Mini label="Total contratado (período)" value={formatCurrency(resumo.contratado)} />
        <Mini label="Total recebido" value={formatCurrency(resumo.recebido)} tone="green" />
        <Mini label="Total pendente" value={formatCurrency(resumo.pendente)} tone="red" />
        <Mini label="Média de atraso" value={`${resumo.mediaAtraso} dia(s)`} />
        <Mini label="Último pagamento" value={resumo.ultimoPagamento ? formatCompetencia(resumo.ultimoPagamento) : '—'} />
      </div>

      <div className="flex items-center gap-2">
        <a href={`/api/financeiro/honorarios/inadimplencia/pdf?cliente_id=${clienteId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]"><FileText size={13} /> PDF 24 meses</a>
        <a href={`/api/financeiro/honorarios/inadimplencia/xlsx?cliente_id=${clienteId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]"><FileSpreadsheet size={13} /> Excel</a>
      </div>

      {/* Histórico mensal */}
      {registros.length === 0 ? (
        <p className="text-[13px] text-[#a8b3c4] text-center py-6">Nenhum honorário registrado para este cliente.</p>
      ) : (
        <div className="border border-[#EFEBE6] rounded-lg divide-y divide-[#F3F1EE]">
          {registros.map(r => (
            <div key={r.id} className={`flex items-center gap-3 px-3 py-2 text-[13px] ${r.cancelado ? 'opacity-45 line-through' : ''}`}>
              <span className="w-28 font-medium text-[#0f1923]">{formatCompetencia(r.competencia)}</span>
              {r.tipo === 'extra' && <span className="text-[10px] font-semibold text-[#1c4e9c] bg-[#eaf1fb] px-1.5 py-0.5 rounded-full no-underline">Extra {r.parcela_num}/{r.parcela_total}</span>}
              <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 no-underline ${STATUS_COR[r.status]}`}>{HONORARIO_STATUS_LABELS[r.status]}</span>
              <span className="ml-auto text-[#5a6675]">devido {formatCurrency(r.valor_devido + r.saldo_anterior)}</span>
              <span className="text-[#1a7a45]">pago {formatCurrency(r.valor_pago)}</span>
              <span className="w-28 text-right font-medium text-[#0f1923]">saldo {formatCurrency(r.saldo_pendente)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-[#1a7a45]' : tone === 'red' ? 'text-[#a93226]' : 'text-[#0f1923]'
  return (
    <div className="bg-white border border-[#E2DDD8] rounded-lg px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[#7a8899]">{label}</p>
      <p className={`text-[15px] font-semibold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}
