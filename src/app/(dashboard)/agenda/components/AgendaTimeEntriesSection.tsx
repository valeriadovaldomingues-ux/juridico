'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Clock3, DollarSign, FileText, BadgeInfo } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgendaItem } from '../agenda-types'
import type { AgendaTimeEntry, UserRole } from '@/types'
import {
  AgendaTimeEntryDraft,
  buildAgendaTimeEntrySummary,
  calculateEffectiveMinutes,
  formatCurrencyBRL,
  formatDurationMinutes,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/lib/agenda-time-entries'

interface FormState {
  agenda_item_id: string
  cliente_id: string
  processo_id: string
  descricao_atividade: string
  observacoes: string
  inicio_local: string
  fim_local: string
  usa_duracao_manual: boolean
  duracao_manual_minutos: string
  cobravel: boolean
  valor_hora: string
  status_cobranca: AgendaTimeEntry['status_cobranca']
}

interface Props {
  agendaItem: AgendaItem | null
  timeEntries: AgendaTimeEntry[]
  clientes: Array<{ id: string; nome: string }>
  processos: Array<{ id: string; titulo: string }>
  currentUserId: string
  currentUserRole: UserRole
  canManage: boolean
  onUpsert: (entryId: string | null, draft: AgendaTimeEntryDraft) => Promise<AgendaTimeEntry | null>
  onDelete: (entryId: string) => Promise<boolean>
  saving: boolean
  deletingId: string | null
}

function buildDefaultForm(agendaItem: AgendaItem | null): FormState {
  const defaultStart = agendaItem
    ? toDatetimeLocalValue(new Date(`${agendaItem.data_inicio}T${agendaItem.hora_inicio ?? '09:00:00'}`).toISOString())
    : ''

  return {
    agenda_item_id: agendaItem?.id ?? '',
    cliente_id: agendaItem?.cliente_id ?? '',
    processo_id: agendaItem?.processo_id ?? '',
    descricao_atividade: agendaItem?.titulo ?? '',
    observacoes: '',
    inicio_local: defaultStart,
    fim_local: '',
    usa_duracao_manual: false,
    duracao_manual_minutos: '',
    cobravel: true,
    valor_hora: '',
    status_cobranca: 'pendente',
  }
}

function buildFormFromEntry(entry: AgendaTimeEntry, agendaItem: AgendaItem | null): FormState {
  return {
    agenda_item_id: entry.agenda_item_id || agendaItem?.id || '',
    cliente_id: entry.cliente_id ?? agendaItem?.cliente_id ?? '',
    processo_id: entry.processo_id ?? agendaItem?.processo_id ?? '',
    descricao_atividade: entry.descricao_atividade || agendaItem?.titulo || '',
    observacoes: entry.observacoes ?? '',
    inicio_local: toDatetimeLocalValue(entry.inicio_em),
    fim_local: toDatetimeLocalValue(entry.fim_em),
    usa_duracao_manual: entry.usa_duracao_manual,
    duracao_manual_minutos: entry.duracao_manual_minutos?.toString() ?? '',
    cobravel: entry.cobravel,
    valor_hora: entry.valor_hora?.toString() ?? '',
    status_cobranca: entry.status_cobranca,
  }
}

export default function AgendaTimeEntriesSection({
  agendaItem,
  timeEntries,
  clientes,
  processos,
  currentUserId,
  currentUserRole,
  canManage,
  onUpsert,
  onDelete,
  saving,
  deletingId,
}: Props) {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => buildDefaultForm(agendaItem))
  const [localError, setLocalError] = useState<string | null>(null)

  const summary = useMemo(() => buildAgendaTimeEntrySummary(timeEntries), [timeEntries])

  useEffect(() => {
    setEditingEntryId(null)
    setForm(buildDefaultForm(agendaItem))
    setLocalError(null)
  }, [agendaItem?.id])

  function canModifyEntry(entry: AgendaTimeEntry) {
    if (!canManage) return false
    if (currentUserRole === 'advogado') return entry.criado_por === currentUserId
    return true
  }

  function startEditing(entry: AgendaTimeEntry) {
    setEditingEntryId(entry.id)
    setForm(buildFormFromEntry(entry, agendaItem))
    setLocalError(null)
  }

  function cancelEditing() {
    setEditingEntryId(null)
    setForm(buildDefaultForm(agendaItem))
    setLocalError(null)
  }

  async function handleSubmit() {
    if (!agendaItem?.id) {
      setLocalError('Salve o evento antes de lançar horas.')
      return
    }

    const inicioEm = fromDatetimeLocalValue(form.inicio_local)
    if (!inicioEm) {
      setLocalError('Informe a data e hora inicial.')
      return
    }

    const fimEm = fromDatetimeLocalValue(form.fim_local)
    const duracaoManual = form.duracao_manual_minutos.trim()
    const manualMinutes = duracaoManual ? Number(duracaoManual) : null

    if (!form.usa_duracao_manual && !fimEm) {
      setLocalError('Informe a data e hora final ou marque duração manual.')
      return
    }

    if (form.usa_duracao_manual && (manualMinutes === null || Number.isNaN(manualMinutes))) {
      setLocalError('Informe a duração manual em minutos.')
      return
    }

    const valorHora = form.valor_hora.trim() ? Number(form.valor_hora) : null
    if (form.valor_hora.trim() && Number.isNaN(valorHora)) {
      setLocalError('Valor hora inválido.')
      return
    }

    setLocalError(null)

    const draft: AgendaTimeEntryDraft = {
      agenda_item_id: agendaItem.id,
      cliente_id: form.cliente_id || null,
      processo_id: form.processo_id || null,
      descricao_atividade: form.descricao_atividade.trim(),
      observacoes: form.observacoes.trim() || null,
      inicio_em: inicioEm,
      fim_em: fimEm,
      duracao_manual_minutos: manualMinutes,
      usa_duracao_manual: form.usa_duracao_manual,
      cobravel: form.cobravel,
      valor_hora: valorHora,
      status_cobranca: form.cobravel ? form.status_cobranca : 'nao_faturavel',
    }

    const saved = await onUpsert(editingEntryId, draft)
    if (!saved) return

    cancelEditing()
  }

  async function handleDeleteEntry(entry: AgendaTimeEntry) {
    const ok = window.confirm('Tem certeza que deseja excluir este lançamento de horas?')
    if (!ok) return
    await onDelete(entry.id)
    if (editingEntryId === entry.id) {
      cancelEditing()
    }
  }

  const effectiveEntries = timeEntries
    .slice()
    .sort((a, b) => new Date(b.inicio_em).getTime() - new Date(a.inicio_em).getTime())

  const editableNote = currentUserRole === 'advogado'
    ? 'Advogados podem alterar apenas os próprios lançamentos.'
    : 'Administrativo, advogado, gerente e sócio podem lançar horas.'

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)]">Cobrança</p>
          <h3 className="font-brand text-[20px] font-semibold text-[var(--color-ink)]">Horas e cobrança</h3>
          <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
            Registre o tempo gasto no evento, com vínculo opcional ao cliente e ao processo.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 text-[11px] font-medium text-[var(--color-ink-2)]">
          <span className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1">
            {summary.entryCount} lançamento(s)
          </span>
          <span className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1">
            {formatDurationMinutes(summary.totalMinutes)} total
          </span>
          <span className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1">
            {summary.billableMinutes > 0 ? `${formatDurationMinutes(summary.billableMinutes)} cobravel` : 'Sem horas cobráveis'}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!agendaItem?.id && (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-[12px] text-[var(--color-ink-2)]">
            Salve o evento primeiro para lançar horas e cobrança.
          </div>
        )}

        {agendaItem?.id && (
          <>
            {canManage ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-ink)]">
                  <BadgeInfo size={14} className="text-[var(--color-copper)]" />
                  {editingEntryId ? 'Editando lançamento' : 'Novo lançamento de horas'}
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">{editableNote}</p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Início
                    </label>
                    <input
                      type="datetime-local"
                      value={form.inicio_local}
                      onChange={e => setForm(prev => ({ ...prev, inicio_local: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Fim
                    </label>
                    <input
                      type="datetime-local"
                      value={form.fim_local}
                      onChange={e => setForm(prev => ({ ...prev, fim_local: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-ink-2)]">
                    <input
                      type="checkbox"
                      checked={form.usa_duracao_manual}
                      onChange={e => setForm(prev => ({ ...prev, usa_duracao_manual: e.target.checked }))}
                    />
                    Usar duração manual
                  </label>
                  <div className="w-full sm:w-auto sm:min-w-[180px]">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Duração manual (min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.duracao_manual_minutos}
                      onChange={e => setForm(prev => ({ ...prev, duracao_manual_minutos: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Cliente
                    </label>
                    <select
                      value={form.cliente_id}
                      onChange={e => setForm(prev => ({ ...prev, cliente_id: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                    >
                      <option value="">— Nenhum —</option>
                      {clientes.map(cliente => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Processo
                    </label>
                    <select
                      value={form.processo_id}
                      onChange={e => setForm(prev => ({ ...prev, processo_id: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                    >
                      <option value="">— Nenhum —</option>
                      {processos.map(processo => (
                        <option key={processo.id} value={processo.id}>
                          {processo.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Descrição da atividade
                    </label>
                    <input
                      type="text"
                      value={form.descricao_atividade}
                      onChange={e => setForm(prev => ({ ...prev, descricao_atividade: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                      placeholder="Ex.: análise de contestação"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Valor hora
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valor_hora}
                      onChange={e => setForm(prev => ({ ...prev, valor_hora: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-ink-2)]">
                      <input
                        type="checkbox"
                        checked={form.cobravel}
                        onChange={e => setForm(prev => ({
                          ...prev,
                          cobravel: e.target.checked,
                          status_cobranca: e.target.checked ? 'pendente' : 'nao_faturavel',
                        }))}
                      />
                      Cobrável
                    </label>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      Status de cobrança
                    </label>
                    <select
                      value={form.status_cobranca}
                      onChange={e => setForm(prev => ({ ...prev, status_cobranca: e.target.value as AgendaTimeEntry['status_cobranca'] }))}
                      disabled={!form.cobravel}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 disabled:bg-[var(--color-surface-warm)]"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="faturado">Faturado</option>
                      <option value="nao_faturavel">Não faturável</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                    Observações
                  </label>
                  <textarea
                    rows={3}
                    value={form.observacoes}
                    onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                    className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10"
                    placeholder="Anotações internas, vínculo com faturamento, etc."
                  />
                </div>

                {localError && (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                    {localError}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-sidebar)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-petrol)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingEntryId ? <Pencil size={14} /> : <Plus size={14} />}
                    {editingEntryId ? 'Atualizar lançamento' : 'Adicionar lançamento'}
                  </button>
                  {editingEntryId && (
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface-warm)] disabled:opacity-50"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>

                <p className="mt-3 text-[11px] text-[var(--color-ink-3)]">
                  {form.usa_duracao_manual
                    ? 'A duração manual prevalece sobre o cálculo entre início e fim.'
                    : 'Se informar início e fim, a duração será calculada automaticamente.'}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-[12px] text-[var(--color-ink-2)]">
                Este perfil pode visualizar os lançamentos de horas, mas não criar ou editar cobranças.
              </div>
            )}

            <div className="space-y-2">
              {effectiveEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-[12px] text-[var(--color-ink-3)]">
                  Nenhum lançamento de horas registrado para este evento.
                </div>
              ) : (
                effectiveEntries.map(entry => {
                  const effectiveMinutes = calculateEffectiveMinutes(entry)
                  const canEdit = canModifyEntry(entry)

                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(13,34,53,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                            {entry.descricao_atividade || agendaItem.titulo}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-ink-3)]">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-warm)] px-2 py-0.5">
                              <Clock3 size={10} />
                              {toDatetimeLocalValue(entry.inicio_em).replace('T', ' ')}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-warm)] px-2 py-0.5">
                              <Clock3 size={10} />
                              {formatDurationMinutes(effectiveMinutes)}
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                              entry.cobravel && entry.status_cobranca !== 'nao_faturavel'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500',
                            )}>
                              {entry.cobravel && entry.status_cobranca !== 'nao_faturavel' ? 'Cobrável' : 'Não faturável'}
                            </span>
                            {entry.valor_total !== null && entry.valor_total !== undefined && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-petrol-light)] px-2 py-0.5 text-[var(--color-petrol)]">
                                <DollarSign size={10} />
                                {formatCurrencyBRL(entry.valor_total)}
                              </span>
                            )}
                          </p>

                          {(entry.cliente?.nome || entry.processo?.titulo || entry.observacoes) && (
                            <div className="mt-2 space-y-1 text-[11px] text-[var(--color-ink-3)]">
                              {entry.cliente?.nome && (
                                <p>Cliente: <span className="text-[var(--color-ink-2)]">{entry.cliente.nome}</span></p>
                              )}
                              {entry.processo?.titulo && (
                                <p>Processo: <span className="text-[var(--color-ink-2)]">{entry.processo.titulo}</span></p>
                              )}
                              {entry.observacoes && (
                                <p className="inline-flex items-start gap-1">
                                  <FileText size={10} className="mt-0.5 shrink-0" />
                                  <span>{entry.observacoes}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            <button
                              onClick={() => startEditing(entry)}
                              disabled={saving || deletingId === entry.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface-warm)] disabled:cursor-not-allowed disabled:opacity-50"
                              title="Editar lançamento"
                              aria-label="Editar lançamento"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => void handleDeleteEntry(entry)}
                              disabled={saving || deletingId === entry.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-red-500 transition-colors hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Excluir lançamento"
                              aria-label="Excluir lançamento"
                            >
                              {deletingId === entry.id ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
