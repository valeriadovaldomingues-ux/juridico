'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KanbanTask, KanbanStatus, KanbanPrioridade } from '@/types/kanban'
import type { KanbanProfile } from '@/types/kanban'
import KanbanHistorico from './KanbanHistorico'

const AREAS = [
  'Civil', 'Trabalhista', 'Criminal', 'Tributário',
  'Previdenciário', 'Administrativo', 'Família', 'Empresarial', 'Outro',
]

interface Processo { id: string; titulo: string; numero_processo?: string | null }

interface Props {
  task?:      KanbanTask | null     // null = criar novo
  profiles:   KanbanProfile[]
  processos:  Processo[]
  defaultResponsavelId?: string
  defaultStatus?: KanbanStatus
  publicacaoId?: string             // vindo de publicações
  publicacaoTexto?: string          // sugestão de título
  onClose: () => void
  onSave:  (data: Partial<KanbanTask>) => Promise<void>
}

const inputCls = 'w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#145A5B] text-[#374151] placeholder:text-[#c5cdd8] transition-all'

export default function TaskModal({
  task, profiles, processos, defaultResponsavelId, defaultStatus,
  publicacaoId, publicacaoTexto, onClose, onSave,
}: Props) {
  const isEdit = !!task

  const [aba, setAba] = useState<'detalhes' | 'historico'>('detalhes')

  const [titulo,        setTitulo]        = useState(task?.titulo ?? publicacaoTexto ?? '')
  const [descricao,     setDescricao]     = useState(task?.descricao ?? '')
  const [status,        setStatus]        = useState<KanbanStatus>(task?.status ?? defaultStatus ?? 'a_fazer')
  const [prioridade,    setPrioridade]    = useState<KanbanPrioridade>(task?.prioridade ?? 'media')
  const [responsavelId, setResponsavelId] = useState(task?.responsavel_id ?? defaultResponsavelId ?? '')
  const [processoId,    setProcessoId]    = useState(task?.processo_id ?? '')
  const [partes,        setPartes]        = useState(task?.partes_resumidas ?? '')
  const [areaJuridica,  setAreaJuridica]  = useState(task?.area_juridica ?? '')
  const [pendencia,     setPendencia]     = useState(task?.pendencia_motivo ?? '')
  const [prazo,         setPrazo]         = useState(task?.data ?? '')
  const [saving,        setSaving]        = useState(false)
  const [erro,          setErro]          = useState('')

  // Auto-preenche número do processo ao selecionar processo
  const processoSel = processos.find(p => p.id === processoId)

  useEffect(() => {
    if (status !== 'com_pendencia') setPendencia('')
  }, [status])

  async function handleSave() {
    if (!titulo.trim()) { setErro('Título obrigatório'); return }
    setSaving(true)
    setErro('')
    try {
      await onSave({
        titulo:           titulo.trim(),
        descricao:        descricao.trim() || null,
        status,
        prioridade,
        responsavel_id:   responsavelId || null,
        processo_id:      processoId || null,
        numero_processo:  processoSel?.numero_processo ?? task?.numero_processo ?? null,
        partes_resumidas: partes.trim() || null,
        area_juridica:    areaJuridica || null,
        pendencia_motivo: pendencia.trim() || null,
        data:             prazo || null,
        publicacao_id:    publicacaoId ?? task?.publicacao_id ?? null,
        origem:           publicacaoId ? 'publicacao' : task?.origem ?? 'manual',
      })
      onClose()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const STATUS_OPT: { v: KanbanStatus; l: string }[] = [
    { v: 'a_fazer',       l: 'A Fazer'       },
    { v: 'fazendo',       l: 'Fazendo'       },
    { v: 'com_pendencia', l: 'Com Pendência' },
    { v: 'concluido',     l: 'Concluído'     },
  ]
  const PRI_OPT: { v: KanbanPrioridade; l: string }[] = [
    { v: 'baixa',   l: 'Baixa'   },
    { v: 'media',   l: 'Média'   },
    { v: 'alta',    l: 'Alta'    },
    { v: 'urgente', l: 'Urgente' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-6 border-b border-[#f3f4f6] z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-[#0f1923]">
              {isEdit ? 'Editar tarefa' : 'Nova tarefa'}
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#f3f4f6] text-[#9ca3af]">
              <X size={15} />
            </button>
          </div>

          {/* Abas — só no modo edição */}
          {isEdit && (
            <div className="flex gap-1">
              {(['detalhes', 'historico'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => setAba(a)}
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-semibold rounded-t-lg transition-colors',
                    aba === a
                      ? 'text-[#0F3D3E] border-b-2 border-[#0F3D3E]'
                      : 'text-[#9ca3af] hover:text-[#374151]',
                  )}
                >
                  {a === 'detalhes' ? 'Detalhes' : 'Histórico'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Aba Histórico */}
          {isEdit && aba === 'historico' && task && (
            <KanbanHistorico taskId={task.id} />
          )}

          {/* Conteúdo da aba Detalhes */}
          {(!isEdit || aba === 'detalhes') && <>

          {/* Título */}
          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Título *</label>
            <input
              value={titulo}
              onChange={e => { setTitulo(e.target.value); setErro('') }}
              placeholder="Ex: Elaborar contestação — Proc. 123"
              className={inputCls}
            />
          </div>

          {/* Status + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Status</label>
              <select className={inputCls} value={status} onChange={e => setStatus(e.target.value as KanbanStatus)}>
                {STATUS_OPT.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Prioridade</label>
              <select className={inputCls} value={prioridade} onChange={e => setPrioridade(e.target.value as KanbanPrioridade)}>
                {PRI_OPT.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          </div>

          {/* Responsável + Prazo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Responsável</label>
              <select className={inputCls} value={responsavelId} onChange={e => setResponsavelId(e.target.value)}>
                <option value="">— Sem responsável —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Prazo</label>
              <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Processo */}
          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Processo vinculado</label>
            <select className={inputCls} value={processoId} onChange={e => setProcessoId(e.target.value)}>
              <option value="">— Nenhum —</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          </div>

          {/* Partes / Área */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Partes resumidas</label>
              <input value={partes} onChange={e => setPartes(e.target.value)} placeholder="Ex: Silva x Banco" className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Área jurídica</label>
              <select className={inputCls} value={areaJuridica} onChange={e => setAreaJuridica(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Motivo de pendência (apenas se status = com_pendencia) */}
          {status === 'com_pendencia' && (
            <div>
              <label className="block text-[11px] font-semibold text-orange-600 uppercase tracking-wide mb-1.5">Motivo da pendência</label>
              <input
                value={pendencia}
                onChange={e => setPendencia(e.target.value)}
                placeholder="Ex: Aguardando documentos do cliente"
                className={cn(inputCls, 'focus:border-orange-400')}
              />
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Observações</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              placeholder="Detalhes adicionais…"
              className={cn(inputCls, 'resize-none')}
            />
          </div>

          {publicacaoId && (
            <div className="flex items-center gap-2 bg-violet-50 rounded-xl px-3 py-2.5 border border-violet-100">
              <span className="text-[11px] text-violet-700 font-medium">
                Esta tarefa será vinculada a uma publicação.
              </span>
            </div>
          )}

          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#7a8899] hover:bg-[#f9fafb]">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !titulo.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#0F3D3E] text-white text-[13px] font-semibold hover:bg-[#145A5B] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
          </div>
          </>}
        </div>
      </div>
    </div>
  )
}
