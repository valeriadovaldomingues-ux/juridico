'use client'

import { AlertCircle, Clock } from 'lucide-react'
import {
  CRM_SOCIOS_DIAS_PARADA, ETAPA_LABEL, STATUS_OPORTUNIDADE_LABEL,
} from '@/lib/crm-socios/constants'
import { acaoVencida, diasSemInteracao, estaParada } from '@/lib/crm-socios/regras'
import { formatarBRL, formatarDataISO, textoDias } from '@/lib/crm-socios/formato'
import type { CrmOportunidade } from '@/types/crm-socios'
import { ETAPA_PALETA, STATUS_OPORTUNIDADE_CLASSE } from './visual'

interface Props {
  oportunidades: CrmOportunidade[]
  hoje: Date
  onAbrir: (op: CrmOportunidade) => void
}

const COLUNAS = ['Oportunidade', 'Etapa', 'Responsável', 'Valor est.', 'Próxima ação', 'Último contato', 'Status']

export default function ListaOportunidades({ oportunidades, hoje, onAbrir }: Props) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-x-auto shadow-sm">
      <table className="w-full text-sm min-w-[860px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
            {COLUNAS.map(c => (
              <th key={c} className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {oportunidades.length === 0 ? (
            <tr>
              <td colSpan={COLUNAS.length} className="text-center py-12 text-[var(--color-ink-3)] text-sm">
                Nenhuma oportunidade encontrada.
              </td>
            </tr>
          ) : oportunidades.map(op => {
            const parada = estaParada(op, hoje)
            const vencida = acaoVencida(op, hoje)
            const paleta = ETAPA_PALETA[op.etapa]
            return (
              <tr
                key={op.id}
                onClick={() => onAbrir(op)}
                className="border-b border-zinc-50 hover:bg-[var(--color-surface-warm)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-[var(--color-ink)] text-[13px]">{op.nome}</p>
                  <p className="text-[11px] text-[var(--color-ink-3)] truncate max-w-[240px]">
                    {[op.contato_nome, op.area_interesse].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className="text-[11px] font-semibold px-2 py-1 rounded-full"
                    style={{ backgroundColor: paleta.headerBg, color: paleta.text }}
                  >
                    {ETAPA_LABEL[op.etapa]}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] text-[var(--color-ink-2)] whitespace-nowrap">{op.responsavel?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-[12px] font-semibold text-[var(--color-ink)] whitespace-nowrap">{formatarBRL(op.valor_estimado, true)}</td>
                <td className="px-4 py-3">
                  {op.proxima_acao_data ? (
                    <span className={`text-[12px] ${vencida ? 'text-red-600 font-semibold' : 'text-[var(--color-ink-2)]'}`}>
                      {vencida && <AlertCircle size={11} className="inline mr-1 -mt-0.5" />}
                      {formatarDataISO(op.proxima_acao_data)}
                      {op.proxima_acao ? ` · ${op.proxima_acao}` : ''}
                    </span>
                  ) : <span className="text-[12px] text-zinc-300">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-[12px] text-[var(--color-ink-2)]">
                    {op.ultimo_contato_em ? textoDias(diasSemInteracao(op, hoje)) : 'sem contato'}
                  </span>
                  {parada && (
                    <span
                      className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                      title={`Sem interação há mais de ${CRM_SOCIOS_DIAS_PARADA} dias`}
                    >
                      <Clock size={9} />parada
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_OPORTUNIDADE_CLASSE[op.status]}`}>
                    {STATUS_OPORTUNIDADE_LABEL[op.status]}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
