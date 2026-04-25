'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, ArrowRight, User, FileEdit, RefreshCw } from 'lucide-react'
import type { KanbanHistoricoEntry, KanbanStatus } from '@/types/kanban'
import { STATUS_LABELS } from '@/types/kanban'

interface Props {
  taskId: string
}

function fmtRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const horas = Math.floor(diff / 3_600_000)
  const dias  = Math.floor(diff / 86_400_000)

  if (mins  < 1)  return 'agora mesmo'
  if (mins  < 60) return `${mins} min atrás`
  if (horas < 24) return `${horas}h atrás`
  if (dias  === 1) return 'ontem'
  if (dias  < 7)  return `${dias} dias atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtAbsoluto(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_COLOR: Record<KanbanStatus, string> = {
  a_fazer:       'bg-slate-100 text-slate-600',
  fazendo:       'bg-blue-50 text-blue-700',
  com_pendencia: 'bg-orange-50 text-orange-700',
  concluido:     'bg-emerald-50 text-emerald-700',
}

function StatusChip({ s }: { s: KanbanStatus }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLOR[s]}`}>
      {STATUS_LABELS[s]}
    </span>
  )
}

function EntryIcon({ acao }: { acao: KanbanHistoricoEntry['acao'] }) {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0'
  switch (acao) {
    case 'criacao':
      return <div className={`${base} bg-emerald-100`}><Plus size={13} className="text-emerald-600" /></div>
    case 'status':
    case 'status_responsavel':
      return <div className={`${base} bg-blue-100`}><RefreshCw size={12} className="text-blue-600" /></div>
    case 'responsavel':
      return <div className={`${base} bg-violet-100`}><User size={12} className="text-violet-600" /></div>
    case 'edicao':
      return <div className={`${base} bg-amber-100`}><FileEdit size={12} className="text-amber-600" /></div>
    default:
      return <div className={`${base} bg-slate-100`}><RefreshCw size={12} className="text-slate-500" /></div>
  }
}

function EntryText({ entry }: { entry: KanbanHistoricoEntry }) {
  const autor = entry.usuario?.nome ?? 'Sistema'

  switch (entry.acao) {
    case 'criacao':
      return (
        <span>
          <strong className="font-semibold">{autor}</strong> criou a tarefa
          {entry.para_status && (
            <> com status <StatusChip s={entry.para_status as KanbanStatus} /></>
          )}
          {entry.para_responsavel && (
            <> para <strong className="font-semibold">{entry.para_responsavel.nome}</strong></>
          )}
        </span>
      )

    case 'status':
      return (
        <span>
          <strong className="font-semibold">{autor}</strong> alterou o status
          {entry.de_status && <> de <StatusChip s={entry.de_status as KanbanStatus} /></>}
          {entry.para_status && (
            <> <ArrowRight size={10} className="inline mx-0.5" /> <StatusChip s={entry.para_status as KanbanStatus} /></>
          )}
        </span>
      )

    case 'responsavel': {
      const de   = entry.de_responsavel?.nome  ?? 'Sem responsável'
      const para = entry.para_responsavel?.nome ?? 'Sem responsável'
      return (
        <span>
          <strong className="font-semibold">{autor}</strong> alterou o responsável de{' '}
          <span className="font-medium text-[#374151]">{de}</span>
          {' '}<ArrowRight size={10} className="inline mx-0.5" />{' '}
          <span className="font-medium text-[#374151]">{para}</span>
        </span>
      )
    }

    case 'status_responsavel': {
      const para = entry.para_responsavel?.nome ?? 'Sem responsável'
      return (
        <span>
          <strong className="font-semibold">{autor}</strong> moveu para{' '}
          {entry.para_status && <StatusChip s={entry.para_status as KanbanStatus} />}
          {' '}e transferiu para <span className="font-medium text-[#374151]">{para}</span>
        </span>
      )
    }

    case 'edicao':
      return (
        <span>
          <strong className="font-semibold">{autor}</strong> editou os dados da tarefa
        </span>
      )

    default:
      return (
        <span>
          <strong className="font-semibold">{autor}</strong> atualizou a tarefa
        </span>
      )
  }
}

export default function KanbanHistorico({ taskId }: Props) {
  const [entries, setEntries] = useState<KanbanHistoricoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState('')

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    fetch(`/api/kanban-tasks/${taskId}/historico`)
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setErro('Erro ao carregar histórico'); setLoading(false) })
  }, [taskId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[#9ca3af]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-[12px]">Carregando histórico…</span>
      </div>
    )
  }

  if (erro) {
    return <p className="text-[12px] text-red-500 py-4 text-center">{erro}</p>
  }

  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-[#9ca3af] py-6 text-center">
        Nenhuma movimentação registrada.
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-3">
          {/* Linha vertical + ícone */}
          <div className="flex flex-col items-center">
            <EntryIcon acao={entry.acao} />
            {i < entries.length - 1 && (
              <div className="w-px flex-1 bg-[#f0f2f5] mt-1 mb-1 min-h-[16px]" />
            )}
          </div>

          {/* Conteúdo */}
          <div className="pb-4 pt-0.5 min-w-0">
            <p className="text-[12px] text-[#374151] leading-snug">
              <EntryText entry={entry} />
            </p>
            <p
              className="text-[10px] text-[#9ca3af] mt-0.5 cursor-default"
              title={fmtAbsoluto(entry.created_at)}
            >
              {fmtRelativo(entry.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
