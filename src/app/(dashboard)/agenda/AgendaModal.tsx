'use client'

import { useEffect, useRef } from 'react'
import { X, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AgendaForm, AgendaItem, Processo, Cliente,
  TIPO_CFG, PRIO_CFG, Tipo, Status, Prioridade,
} from './agenda-types'

interface Props {
  form: AgendaForm
  setForm: (f: AgendaForm) => void
  isEdit: boolean
  processos: Processo[]
  clientes: Cliente[]
  onSave: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  canDelete: boolean
  onClose: () => void
  saving: boolean
}

export default function AgendaModal({
  form, setForm, isEdit, processos, clientes,
  onSave, onDelete, onDuplicate, canDelete, onClose, saving,
}: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const set = (patch: Partial<AgendaForm>) => setForm({ ...form, ...patch })

  const hasTime  = form.tipo === 'evento' || form.tipo === 'audiencia'
  const hasPrazo = form.tipo === 'prazo'  || form.tipo === 'audiencia'

  const inputCls = [
    'w-full rounded-xl border border-[var(--color-border)] bg-white',
    'px-3.5 py-2.5 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]',
    'focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors',
  ].join(' ')
  const labelCls = 'block text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.08em]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]/55">
          <h2 className="font-brand text-[24px] font-semibold text-[var(--color-ink)]">
            {isEdit ? 'Editar item' : 'Novo item'}
          </h2>
          <div className="flex items-center gap-1">
            {isEdit && onDuplicate && (
              <button
                onClick={onDuplicate}
                title="Duplicar item"
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F0F6F6] transition-colors"
              >
                <Copy size={14} className="text-[#9aabb8]" />
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F0F6F6] transition-colors">
              <X size={15} className="text-[#9aabb8]" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Título */}
          <div>
            <label className={labelCls}>Título *</label>
            <input
              ref={ref}
              className={inputCls}
              placeholder="Descrição do compromisso"
              value={form.titulo}
              onChange={e => set({ titulo: e.target.value })}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className={labelCls}>Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(TIPO_CFG) as [Tipo, typeof TIPO_CFG[Tipo]][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => set({ tipo: k })}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 text-[11px] font-semibold transition-all',
                    form.tipo === k
                      ? `${v.bg} ${v.text} ${v.border} border-opacity-100`
                      : 'border-[var(--color-border)] text-[var(--color-ink-3)] hover:border-[var(--color-copper)]/50'
                  )}
                >
                  <span className={cn('w-2.5 h-2.5 rounded-full', v.dot)} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className={labelCls}>Prioridade</label>
            <div className="flex gap-2">
              {(Object.entries(PRIO_CFG) as [Prioridade, typeof PRIO_CFG[Prioridade]][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => set({ prioridade: k })}
                  className={cn(
                    'flex-1 py-2 rounded-xl border-2 text-[12px] font-semibold transition-all',
                    form.prioridade === k
                      ? `${v.bg} ${v.text} border-current`
                      : 'border-[var(--color-border)] text-[var(--color-ink-3)] hover:border-[var(--color-copper)]/50'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data início + hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data início *</label>
              <input type="date" className={inputCls} value={form.data_inicio} onChange={e => set({ data_inicio: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>{hasTime ? 'Hora início' : 'Hora (opcional)'}</label>
              <input type="time" className={inputCls} value={form.hora_inicio} onChange={e => set({ hora_inicio: e.target.value })} />
            </div>
          </div>

          {/* Data fim + hora fim (eventos e audiências) */}
          {hasTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data fim</label>
                <input type="date" className={inputCls} value={form.data_fim} onChange={e => set({ data_fim: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Hora fim</label>
                <input type="time" className={inputCls} value={form.hora_fim} onChange={e => set({ hora_fim: e.target.value })} />
              </div>
            </div>
          )}

          {/* Prazo fatal (prazos e audiências) */}
          {hasPrazo && (
            <div>
              <label className={labelCls}>Prazo fatal</label>
              <input type="date" className={inputCls} value={form.prazo_final} onChange={e => set({ prazo_final: e.target.value })} />
            </div>
          )}

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={e => set({ status: e.target.value as Status })}>
              <option value="pendente">Pendente</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Processo + Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Processo</label>
              <select className={inputCls} value={form.processo_id} onChange={e => set({ processo_id: e.target.value })}>
                <option value="">— Nenhum —</option>
                {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cliente</label>
              <select className={inputCls} value={form.cliente_id} onChange={e => set({ cliente_id: e.target.value })}>
                <option value="">— Nenhum —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Responsável */}
          <div>
            <label className={labelCls}>Responsável</label>
            <input
              className={inputCls}
              placeholder="Nome do responsável"
              value={form.responsavel}
              onChange={e => set({ responsavel: e.target.value })}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className={labelCls}>Descrição / Observações</label>
            <textarea
              rows={3}
              className={cn(inputCls, 'resize-none')}
              placeholder="Detalhes adicionais..."
              value={form.descricao}
              onChange={e => set({ descricao: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center gap-3">
          {isEdit && canDelete && onDelete && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-500 hover:text-red-700 transition-colors mr-auto"
            >
              <Trash2 size={13} /> Excluir
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-ink-2)] hover:bg-[var(--color-surface-warm)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={!form.titulo.trim() || !form.data_inicio || saving}
            className="flex-1 py-2.5 rounded-xl bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}
