'use client'

import { AlertCircle, CalendarClock } from 'lucide-react'
import { CRM_SOCIOS_QTD_PROXIMAS_ACOES } from '@/lib/crm-socios/constants'
import { acaoHoje, acaoVencida, proximasAcoes } from '@/lib/crm-socios/regras'
import { formatarDataISO } from '@/lib/crm-socios/formato'
import type { CrmOportunidade } from '@/types/crm-socios'

interface Props {
  oportunidades: CrmOportunidade[]
  hoje: Date
  onAbrir: (op: CrmOportunidade) => void
}

/** Faixa no topo: as próximas ações mais urgentes (vencidas primeiro) entre as oportunidades abertas. */
export default function ProximasAcoes({ oportunidades, hoje, onAbrir }: Props) {
  const acoes = proximasAcoes(oportunidades, CRM_SOCIOS_QTD_PROXIMAS_ACOES)

  return (
    <section
      aria-label="Próximas ações"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[0_8px_24px_rgba(13,34,53,0.04)]"
    >
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-copper)] mb-2">
        Próximas ações
      </h2>
      {acoes.length === 0 ? (
        <p className="text-[12px] text-[var(--color-ink-3)]">
          Nenhuma próxima ação agendada. Defina uma data na ficha de cada oportunidade para ela aparecer aqui.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {acoes.map(op => {
            const vencida = acaoVencida(op, hoje)
            const hojeAcao = acaoHoje(op, hoje)
            return (
              <li key={op.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(op)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                    vencida
                      ? 'border-red-200 bg-red-50 hover:bg-red-100/70'
                      : hojeAcao
                        ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
                        : 'border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-warm)]'
                  }`}
                >
                  <span className={`flex items-center gap-1 text-[11px] font-semibold ${vencida ? 'text-red-700' : hojeAcao ? 'text-amber-700' : 'text-[var(--color-ink-2)]'}`}>
                    {vencida ? <AlertCircle size={11} /> : <CalendarClock size={11} />}
                    {formatarDataISO(op.proxima_acao_data)}
                    {vencida ? ' · vencida' : hojeAcao ? ' · hoje' : ''}
                  </span>
                  <span className="block mt-0.5 text-[12px] font-semibold text-[var(--color-ink)] truncate">{op.nome}</span>
                  <span className="block text-[11px] text-[var(--color-ink-3)] truncate">{op.proxima_acao || 'Sem descrição'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
