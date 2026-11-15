// CRM Cris e Val — paleta e classes compartilhadas pela UI.

import type { EtapaId, StatusOportunidade, StatusProposta } from '@/lib/crm-socios/constants'

export const ETAPA_PALETA: Record<EtapaId, { accent: string; bg: string; headerBg: string; text: string }> = {
  contato_inicial:  { accent: '#3b82f6', bg: '#eff6ff', headerBg: '#dbeafe', text: '#1d4ed8' },
  reuniao_marcada:  { accent: '#8b5cf6', bg: '#f5f3ff', headerBg: '#ede9fe', text: '#6d28d9' },
  reuniao_feita:    { accent: '#06b6d4', bg: '#ecfeff', headerBg: '#cffafe', text: '#0e7490' },
  proposta_enviada: { accent: '#6366f1', bg: '#eef2ff', headerBg: '#e0e7ff', text: '#4338ca' },
  negociacao:       { accent: '#f97316', bg: '#fff7ed', headerBg: '#ffedd5', text: '#c2410c' },
  fechado:          { accent: '#059669', bg: '#ecfdf5', headerBg: '#d1fae5', text: '#047857' },
  perdido:          { accent: '#ef4444', bg: '#fef2f2', headerBg: '#fee2e2', text: '#b91c1c' },
}

export const STATUS_OPORTUNIDADE_CLASSE: Record<StatusOportunidade, string> = {
  aberto: 'bg-blue-50 text-blue-700',
  ganho: 'bg-emerald-50 text-emerald-700',
  perdido: 'bg-red-50 text-red-600',
}

export const STATUS_PROPOSTA_CLASSE: Record<StatusProposta, string> = {
  rascunho: 'bg-zinc-100 text-zinc-600',
  enviada: 'bg-indigo-50 text-indigo-700',
  aceita: 'bg-emerald-50 text-emerald-700',
  recusada: 'bg-red-50 text-red-600',
}

export const INPUT_CLASSE =
  'w-full px-3 py-2 text-[13px] rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink)] ' +
  'placeholder:text-[var(--color-ink-3)] outline-none transition-all ' +
  'focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 disabled:opacity-60'

export const ROTULO_CLASSE =
  'block text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.08em]'

export const BOTAO_PRIMARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-petrol)] text-white text-[13px] font-semibold ' +
  'hover:bg-[var(--color-petrol-mid)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

export const BOTAO_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-white text-[13px] ' +
  'font-medium text-[var(--color-ink-2)] hover:bg-[var(--color-surface-warm)] transition-colors disabled:opacity-60'
