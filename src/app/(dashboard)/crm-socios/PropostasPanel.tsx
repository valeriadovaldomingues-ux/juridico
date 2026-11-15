'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  STATUS_PROPOSTA, STATUS_PROPOSTA_LABEL, TIPOS_HONORARIO, TIPO_HONORARIO_LABEL,
  type StatusProposta, type TipoHonorario,
} from '@/lib/crm-socios/constants'
import { dataISOLocal } from '@/lib/crm-socios/regras'
import { formatarBRL, formatarDataISO, lerValorBR } from '@/lib/crm-socios/formato'
import { jsonInit, requisitar } from '@/lib/crm-socios/cliente-http'
import type { CrmProposta } from '@/types/crm-socios'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, INPUT_CLASSE, ROTULO_CLASSE, STATUS_PROPOSTA_CLASSE } from './visual'

interface Props {
  oportunidadeId: string
  propostas: CrmProposta[]
  onMudou: (propostas: CrmProposta[]) => void
  /** Avisa o pai que uma proposta entrou nesse status (ele decide se sugere mudar a etapa). */
  onStatusDefinido: (status: StatusProposta) => void
}

interface FormProposta {
  titulo: string
  descricao: string
  valor: string
  tipo_honorario: TipoHonorario
  forma_pagamento: string
  data_envio: string
  validade: string
  status: StatusProposta
  observacoes: string
}

const VAZIO: FormProposta = {
  titulo: '', descricao: '', valor: '', tipo_honorario: 'fixo', forma_pagamento: '',
  data_envio: '', validade: '', status: 'rascunho', observacoes: '',
}

function doRegistro(p: CrmProposta): FormProposta {
  return {
    titulo: p.titulo,
    descricao: p.descricao ?? '',
    valor: p.valor === null ? '' : String(p.valor).replace('.', ','),
    tipo_honorario: p.tipo_honorario,
    forma_pagamento: p.forma_pagamento ?? '',
    data_envio: p.data_envio ?? '',
    validade: p.validade ?? '',
    status: p.status,
    observacoes: p.observacoes ?? '',
  }
}

export default function PropostasPanel({ oportunidadeId, propostas, onMudou, onStatusDefinido }: Props) {
  // null = formulário fechado · 'nova' = criando · id = editando
  const [editando, setEditando] = useState<string | 'nova' | null>(null)
  const [form, setForm] = useState<FormProposta>(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function abrirNova() { setForm(VAZIO); setErro(null); setEditando('nova') }
  function abrirEdicao(p: CrmProposta) { setForm(doRegistro(p)); setErro(null); setEditando(p.id) }
  const campo = <K extends keyof FormProposta>(k: K, v: FormProposta[K]) => setForm(f => ({ ...f, [k]: v }))

  async function salvar() {
    const valor = lerValorBR(form.valor)
    if (valor !== null && Number.isNaN(valor)) { setErro('Valor inválido.'); return }
    setSalvando(true); setErro(null)
    try {
      const corpo = {
        ...(editando === 'nova' ? { oportunidade_id: oportunidadeId } : {}),
        titulo: form.titulo,
        descricao: form.descricao,
        valor,
        tipo_honorario: form.tipo_honorario,
        forma_pagamento: form.forma_pagamento,
        data_envio: form.data_envio || null,
        validade: form.validade || null,
        status: form.status,
        observacoes: form.observacoes,
      }
      const salva = await requisitar<CrmProposta>(
        editando === 'nova' ? '/api/crm-socios/propostas' : `/api/crm-socios/propostas/${editando}`,
        jsonInit(editando === 'nova' ? 'POST' : 'PATCH', corpo),
      )
      const anterior = propostas.find(p => p.id === salva.id)
      onMudou(anterior ? propostas.map(p => (p.id === salva.id ? salva : p)) : [salva, ...propostas])
      setEditando(null)
      if (!anterior || anterior.status !== salva.status) onStatusDefinido(salva.status)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a proposta.')
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(p: CrmProposta, status: StatusProposta) {
    setErro(null)
    try {
      const atualizada = await requisitar<CrmProposta>(
        `/api/crm-socios/propostas/${p.id}`,
        jsonInit('PATCH', { status, ...(status === 'enviada' && !p.data_envio ? { data_envio: dataISOLocal(new Date()) } : {}) }),
      )
      onMudou(propostas.map(x => (x.id === p.id ? atualizada : x)))
      onStatusDefinido(status)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar a proposta.')
    }
  }

  async function apagar(p: CrmProposta) {
    if (!window.confirm(`Excluir a proposta "${p.titulo}"?`)) return
    setErro(null)
    try {
      await requisitar(`/api/crm-socios/propostas/${p.id}`, jsonInit('DELETE'))
      onMudou(propostas.filter(x => x.id !== p.id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
    }
  }

  return (
    <div className="space-y-4">
      {editando === null && (
        <div className="flex justify-end">
          <button type="button" onClick={abrirNova} className={BOTAO_PRIMARIO}><Plus size={14} />Nova proposta</button>
        </div>
      )}

      {erro && editando === null && <p role="alert" className="text-[12px] text-red-600">{erro}</p>}

      {editando !== null && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-semibold text-[var(--color-ink)]">{editando === 'nova' ? 'Nova proposta de honorários' : 'Editar proposta'}</h4>
            <button type="button" onClick={() => setEditando(null)} aria-label="Fechar formulário" className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100"><X size={14} /></button>
          </div>
          <div>
            <label htmlFor="prop-titulo" className={ROTULO_CLASSE}>Título</label>
            <input id="prop-titulo" value={form.titulo} onChange={e => campo('titulo', e.target.value)} placeholder="Ex.: Assessoria societária mensal" className={INPUT_CLASSE} />
          </div>
          <div>
            <label htmlFor="prop-desc" className={ROTULO_CLASSE}>Descrição / escopo</label>
            <textarea id="prop-desc" rows={2} value={form.descricao} onChange={e => campo('descricao', e.target.value)} className={INPUT_CLASSE} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="prop-valor" className={ROTULO_CLASSE}>Valor (R$)</label>
              <input id="prop-valor" inputMode="decimal" value={form.valor} onChange={e => campo('valor', e.target.value)} placeholder="0,00" className={INPUT_CLASSE} />
            </div>
            <div>
              <label htmlFor="prop-tipo" className={ROTULO_CLASSE}>Tipo</label>
              <select id="prop-tipo" value={form.tipo_honorario} onChange={e => campo('tipo_honorario', e.target.value as TipoHonorario)} className={INPUT_CLASSE}>
                {TIPOS_HONORARIO.map(t => <option key={t} value={t}>{TIPO_HONORARIO_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="prop-status" className={ROTULO_CLASSE}>Status</label>
              <select id="prop-status" value={form.status} onChange={e => campo('status', e.target.value as StatusProposta)} className={INPUT_CLASSE}>
                {STATUS_PROPOSTA.map(s => <option key={s} value={s}>{STATUS_PROPOSTA_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="prop-forma" className={ROTULO_CLASSE}>Forma de pagamento</label>
            <input id="prop-forma" value={form.forma_pagamento} onChange={e => campo('forma_pagamento', e.target.value)} placeholder="Ex.: R$ 3.000/mês + 10% do êxito" className={INPUT_CLASSE} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prop-envio" className={ROTULO_CLASSE}>Data de envio</label>
              <input id="prop-envio" type="date" value={form.data_envio} onChange={e => campo('data_envio', e.target.value)} className={INPUT_CLASSE} />
            </div>
            <div>
              <label htmlFor="prop-validade" className={ROTULO_CLASSE}>Validade</label>
              <input id="prop-validade" type="date" value={form.validade} onChange={e => campo('validade', e.target.value)} className={INPUT_CLASSE} />
            </div>
          </div>
          <div>
            <label htmlFor="prop-obs" className={ROTULO_CLASSE}>Observações</label>
            <textarea id="prop-obs" rows={2} value={form.observacoes} onChange={e => campo('observacoes', e.target.value)} className={INPUT_CLASSE} />
          </div>
          {erro && <p role="alert" className="text-[12px] text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(null)} className={BOTAO_SECUNDARIO} disabled={salvando}>Cancelar</button>
            <button type="button" onClick={salvar} className={BOTAO_PRIMARIO} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar proposta'}</button>
          </div>
        </div>
      )}

      {propostas.length === 0 && editando === null ? (
        <p className="text-[13px] text-[var(--color-ink-3)] text-center py-6">Nenhuma proposta de honorários ainda.</p>
      ) : (
        <ul className="space-y-2">
          {propostas.map(p => (
            <li key={p.id} className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--color-ink)] break-words">{p.titulo}</p>
                  <p className="text-[12px] text-[var(--color-ink-2)] mt-0.5">
                    <strong>{formatarBRL(p.valor)}</strong> · {TIPO_HONORARIO_LABEL[p.tipo_honorario]}
                    {p.forma_pagamento ? ` · ${p.forma_pagamento}` : ''}
                  </p>
                  <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">
                    Envio: {formatarDataISO(p.data_envio)} · validade: {formatarDataISO(p.validade)}
                  </p>
                  {p.descricao && <p className="text-[12px] text-[var(--color-ink-2)] mt-1.5 whitespace-pre-wrap break-words">{p.descricao}</p>}
                  {p.observacoes && <p className="text-[11px] italic text-[var(--color-ink-3)] mt-1 whitespace-pre-wrap break-words">{p.observacoes}</p>}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${STATUS_PROPOSTA_CLASSE[p.status]}`}>
                  {STATUS_PROPOSTA_LABEL[p.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {p.status !== 'enviada' && p.status !== 'aceita' && (
                  <button type="button" onClick={() => mudarStatus(p, 'enviada')} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]">Marcar como enviada</button>
                )}
                {p.status !== 'aceita' && (
                  <button type="button" onClick={() => mudarStatus(p, 'aceita')} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50">Aceita</button>
                )}
                {p.status !== 'recusada' && p.status !== 'aceita' && (
                  <button type="button" onClick={() => mudarStatus(p, 'recusada')} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Recusada</button>
                )}
                <span className="flex-1" />
                <button type="button" onClick={() => abrirEdicao(p)} aria-label="Editar proposta" className="p-1.5 rounded-lg text-zinc-400 hover:text-[var(--color-ink)] hover:bg-zinc-100"><Pencil size={13} /></button>
                <button type="button" onClick={() => apagar(p)} aria-label="Excluir proposta" className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
