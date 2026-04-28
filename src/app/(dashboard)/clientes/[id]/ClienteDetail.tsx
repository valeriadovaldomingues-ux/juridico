'use client'

import { useState, useTransition, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit, Scale, Phone, Mail, MessageCircle, MapPin,
  Clock, Plus, Trash2, User, Building2, Calendar, CheckSquare,
  Tag, Briefcase, AlertTriangle, Zap, ExternalLink, ChevronRight,
  FileText, Users, Send, Newspaper, Check, X, Loader2,
} from 'lucide-react'
import type { Cliente, Processo, ContactInteraction, TipoContato, TipoInteracao } from '@/types'
import ClienteForm from '../ClienteForm'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoContato, string> = {
  cliente: 'Cliente', parte_contraria: 'Parte Contrária',
  parceiro: 'Parceiro', fornecedor: 'Fornecedor', comercial: 'Comercial',
}

const TIPO_COLORS: Record<TipoContato, string> = {
  cliente:         'bg-[#e6f4ee] text-[#1a7a45] border-[#b3dfc6]',
  parte_contraria: 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d]',
  parceiro:        'bg-[#ede9fe] text-[#5b21b6] border-[#c4b5fd]',
  fornecedor:      'bg-[#e0f2fe] text-[#075985] border-[#7dd3fc]',
  comercial:       'bg-[#fce7f3] text-[#9d174d] border-[#f9a8d4]',
}

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

const STATUS_PROCESSO: Record<string, string> = {
  ativo: 'bg-emerald-50 text-emerald-700', suspenso: 'bg-amber-50 text-amber-700',
  arquivado: 'bg-slate-100 text-slate-600', encerrado: 'bg-blue-50 text-blue-700',
}

const STATUS_TAREFA: Record<string, { label: string; color: string }> = {
  a_fazer:       { label: 'A fazer',    color: 'bg-slate-100 text-slate-600'  },
  fazendo:       { label: 'Fazendo',    color: 'bg-blue-50 text-blue-700'     },
  com_pendencia: { label: 'Pendência',  color: 'bg-amber-50 text-amber-700'   },
  concluido:     { label: 'Concluído',  color: 'bg-emerald-50 text-emerald-700' },
}

const INTERACAO_CONFIG: Record<TipoInteracao, { label: string; icon: typeof Phone; color: string; bg: string }> = {
  ligacao:          { label: 'Ligação',          icon: Phone,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
  reuniao:          { label: 'Reunião',           icon: Users,        color: 'text-violet-600',  bg: 'bg-violet-50'  },
  email:            { label: 'E-mail',            icon: Mail,         color: 'text-blue-600',    bg: 'bg-blue-50'    },
  mensagem:         { label: 'Mensagem',          icon: MessageCircle,color: 'text-teal-600',    bg: 'bg-teal-50'    },
  observacao:       { label: 'Observação',        icon: FileText,     color: 'text-slate-500',   bg: 'bg-slate-100'  },
  tarefa_concluida: { label: 'Tarefa concluída',  icon: Check,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
}

function diasSemContato(ultimoContato: string | null): number | null {
  if (!ultimoContato) return null
  return Math.floor((Date.now() - new Date(ultimoContato).getTime()) / 86_400_000)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function diasColor(d: number | null): string {
  if (d === null) return 'text-[#a8b3c4]'
  if (d <= 7)  return 'text-emerald-600'
  if (d <= 30) return 'text-amber-600'
  if (d <= 60) return 'text-orange-600'
  return 'text-red-600'
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfileMin { id: string; nome: string; role: string }

interface Props {
  cliente:              Cliente
  processos:            Partial<Processo & { tribunal?: string; valor_causa?: number }>[]
  interactions:         ContactInteraction[]
  tarefas:              any[]
  agenda:               any[]
  profiles:             ProfileMin[]
  publicacoesPendentes: number
}

type Tab = 'historico' | 'processos' | 'tarefas' | 'agenda'

// ── Alerta inteligente ────────────────────────────────────────────────────────

function AlertaBanner({ dias, tarefasAtrasadas, publicacoesPendentes }: {
  dias: number | null
  tarefasAtrasadas: number
  publicacoesPendentes: number
}) {
  const alertas: { icon: typeof AlertTriangle; msg: string; cor: string }[] = []

  if (dias !== null && dias > 60) {
    alertas.push({ icon: AlertTriangle, msg: `${dias} dias sem contato`, cor: 'bg-red-50 border-red-200 text-red-700' })
  } else if (dias !== null && dias > 30) {
    alertas.push({ icon: AlertTriangle, msg: `${dias} dias sem contato`, cor: 'bg-amber-50 border-amber-200 text-amber-700' })
  }
  if (tarefasAtrasadas > 0) {
    alertas.push({ icon: Zap, msg: `${tarefasAtrasadas} tarefa${tarefasAtrasadas > 1 ? 's' : ''} em atraso`, cor: 'bg-orange-50 border-orange-200 text-orange-700' })
  }
  if (publicacoesPendentes > 0) {
    alertas.push({ icon: Newspaper, msg: `${publicacoesPendentes} publicaç${publicacoesPendentes > 1 ? 'ões' : 'ão'} pendente${publicacoesPendentes > 1 ? 's' : ''}`, cor: 'bg-amber-50 border-amber-200 text-amber-700' })
  }

  if (alertas.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {alertas.map((a, i) => {
        const Icon = a.icon
        return (
          <div key={i} className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium', a.cor)}>
            <Icon size={13} />
            {a.msg}
          </div>
        )
      })}
    </div>
  )
}

// ── Modal criar tarefa ─────────────────────────────────────────────────────────

function CriarTarefaModal({ processos, profiles, onClose, onCreated }: {
  processos: Props['processos']
  profiles:  ProfileMin[]
  onClose:   () => void
  onCreated: (t: any) => void
}) {
  const [titulo,       setTitulo]       = useState('')
  const [processoId,   setProcessoId]   = useState('')
  const [responsavelId,setResponsavelId]= useState('')
  const [prazo,        setPrazo]        = useState('')
  const [prioridade,   setPrioridade]   = useState('media')
  const [saving,       startSave]       = useTransition()
  const [erro,         setErro]         = useState('')

  function submit() {
    if (!titulo.trim()) { setErro('Título obrigatório'); return }
    setErro('')
    startSave(async () => {
      const res = await fetch('/api/kanban-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          status: 'a_fazer',
          prioridade,
          origem: 'manual',
          processo_id:    processoId || null,
          responsavel_id: responsavelId || null,
          data:           prazo || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error ?? 'Erro ao criar tarefa'); return }
      onCreated(json)
      onClose()
    })
  }

  return (
    <Modal title="Nova tarefa" onClose={onClose}>
      <div className="space-y-4">
        <Input label="Título *" value={titulo} onChange={setTitulo} placeholder="Descrição da tarefa" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">Processo</label>
            <select value={processoId} onChange={e => setProcessoId(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B]">
              <option value="">Sem processo</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.numero_processo ?? p.titulo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">Prioridade</label>
            <select value={prioridade} onChange={e => setPrioridade(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B]">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">Responsável</label>
            <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B]">
              <option value="">Sem atribuição</option>
              {profiles.filter(p => ['advogado','gerente','socio'].includes(p.role)).map(p =>
                <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <Input label="Prazo" type="date" value={prazo} onChange={setPrazo} />
        </div>
        {erro && <p className="text-[12px] text-red-600">{erro}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? 'Criando…' : 'Criar tarefa'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-[13px] text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal agendar compromisso ──────────────────────────────────────────────────

function AgendarModal({ clienteId, processos, onClose, onCreated }: {
  clienteId: string
  processos: Props['processos']
  onClose:   () => void
  onCreated: (a: any) => void
}) {
  const [titulo,     setTitulo]     = useState('')
  const [tipo,       setTipo]       = useState('reuniao')
  const [data,       setData]       = useState('')
  const [processoId, setProcessoId] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [saving,     startSave]     = useTransition()
  const [erro,       setErro]       = useState('')

  function submit() {
    if (!titulo.trim() || !data) { setErro('Título e data são obrigatórios'); return }
    setErro('')
    startSave(async () => {
      const res = await fetch('/api/agenda-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          tipo,
          status:       'pendente',
          data_inicio:  data,
          prazo_final:  data,
          prioridade,
          cliente_id:   clienteId,
          processo_id:  processoId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error ?? 'Erro ao agendar'); return }
      onCreated(json)
      onClose()
    })
  }

  return (
    <Modal title="Agendar compromisso" onClose={onClose}>
      <div className="space-y-4">
        <Input label="Título *" value={titulo} onChange={setTitulo} placeholder="Ex: Reunião de alinhamento" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B]">
              <option value="reuniao">Reunião</option>
              <option value="audiencia">Audiência</option>
              <option value="prazo">Prazo</option>
              <option value="tarefa">Tarefa</option>
              <option value="evento">Evento</option>
            </select>
          </div>
          <Input label="Data *" type="date" value={data} onChange={setData} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">Processo</label>
            <select value={processoId} onChange={e => setProcessoId(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B]">
              <option value="">Sem processo</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.numero_processo ?? p.titulo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">Prioridade</label>
            <select value={prioridade} onChange={e => setPrioridade(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B]">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
        </div>
        {erro && <p className="text-[12px] text-red-600">{erro}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
            {saving ? 'Agendando…' : 'Agendar'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-[13px] text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Aba Histórico ──────────────────────────────────────────────────────────────

function HistoricoTab({ clienteId, initial }: { clienteId: string; initial: ContactInteraction[] }) {
  const [items,     setItems]    = useState(initial)
  const [tipo,      setTipo]     = useState<TipoInteracao>('observacao')
  const [descricao, setDescricao]= useState('')
  const [saving,    startSave]   = useTransition()
  const [deleting,  setDeleting] = useState<string | null>(null)
  const [erro,      setErro]     = useState('')

  function handleAdd() {
    if (!descricao.trim()) { setErro('Descreva a interação'); return }
    setErro('')
    startSave(async () => {
      const res = await fetch('/api/contact-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, tipo, descricao }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error ?? 'Erro ao salvar'); return }
      setItems(prev => [json, ...prev])
      setDescricao('')
    })
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/contact-interactions?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  return (
    <div className="space-y-5">
      {/* Formulário */}
      <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.entries(INTERACAO_CONFIG) as [TipoInteracao, typeof INTERACAO_CONFIG[TipoInteracao]][]).map(([k, cfg]) => {
            const Icon = cfg.icon
            return (
              <button key={k} onClick={() => setTipo(k)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border',
                  tipo === k
                    ? `${cfg.bg} ${cfg.color} border-current/30`
                    : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f3f4f6]',
                )}>
                <Icon size={11} /> {cfg.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={descricao} onChange={e => setDescricao(e.target.value)}
          placeholder="Descreva o que aconteceu…" rows={3}
          className="w-full px-3 py-2.5 text-[13px] bg-white border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] placeholder:text-[#c5cdd8] resize-none"
        />
        {erro && <p className="text-[12px] text-red-600">{erro}</p>}
        <button onClick={handleAdd} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {saving ? 'Registrando…' : 'Registrar interação'}
        </button>
      </div>

      {/* Timeline */}
      {items.length === 0 ? (
        <EmptyState icon={Clock} msg="Nenhuma interação registrada" />
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-[#f3f4f6]" />
          <div className="space-y-1">
            {items.map(i => {
              const cfg = INTERACAO_CONFIG[i.tipo]
              const Icon = cfg.icon
              return (
                <div key={i.id} className="flex gap-4 group">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10', cfg.bg)}>
                    <Icon size={14} className={cfg.color} />
                  </div>
                  <div className="flex-1 pb-4 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-[11px] font-semibold uppercase tracking-wider', cfg.color)}>
                        {cfg.label}
                      </span>
                      {i.usuario && (
                        <span className="text-[11px] text-[#9ca3af]">
                          por {(i.usuario as any).nome}
                        </span>
                      )}
                      <span className="text-[11px] text-[#c5cdd8] ml-auto">{fmtDateTime(i.created_at)}</span>
                    </div>
                    <p className="text-[13px] text-[#374151] leading-relaxed">{i.descricao}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(i.id)} disabled={deleting === i.id}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-[#c5cdd8] hover:text-red-500 hover:bg-red-50 transition-all shrink-0 mt-1.5 disabled:opacity-30">
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Aba Processos ─────────────────────────────────────────────────────────────

function ProcessosTab({ processos }: { processos: Props['processos'] }) {
  const ativos = processos.filter(p => p.status === 'ativo').length
  return (
    <div className="space-y-3">
      {processos.length > 0 && (
        <div className="flex gap-3 text-[12px]">
          <span className="text-[#9ca3af]">{processos.length} processo{processos.length !== 1 ? 's' : ''} total</span>
          {ativos > 0 && <span className="text-emerald-600 font-medium">· {ativos} ativo{ativos !== 1 ? 's' : ''}</span>}
        </div>
      )}
      {processos.length === 0
        ? <EmptyState icon={Scale} msg="Nenhum processo vinculado" />
        : processos.map(p => (
          <Link key={p.id} href={`/processos/${p.id}`}
            className="flex items-start gap-3 p-4 rounded-xl border border-[#f3f4f6] hover:border-[#D0DCDC] hover:bg-[#f9fafb] transition-all group">
            <div className="w-9 h-9 bg-[#f3f4f6] rounded-xl flex items-center justify-center shrink-0">
              <Scale size={15} className="text-[#9ca3af]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0f1923] truncate">{p.titulo}</p>
              {p.numero_processo && (
                <p className="text-[11px] text-[#9ca3af] font-mono mt-0.5">{p.numero_processo}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] text-[#6b7280]">
                  {AREA_LABELS[p.area_direito ?? ''] ?? p.area_direito}
                </span>
                {p.tribunal && <span className="text-[11px] text-[#9ca3af]">· {p.tribunal}</span>}
                {p.status && (
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', STATUS_PROCESSO[p.status] ?? 'bg-slate-100 text-slate-600')}>
                    {p.status}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={14} className="text-[#c5cdd8] shrink-0 mt-1.5 group-hover:text-[#9ca3af] transition-colors" />
          </Link>
        ))
      }
    </div>
  )
}

// ── Aba Tarefas ───────────────────────────────────────────────────────────────

function TarefasTab({ tarefas, processos, profiles, onCreated }: {
  tarefas:   any[]
  processos: Props['processos']
  profiles:  ProfileMin[]
  onCreated: (t: any) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const hoje = new Date().toISOString().slice(0, 10)

  const pendentes  = tarefas.filter(t => t.status !== 'concluido')
  const concluidas = tarefas.filter(t => t.status === 'concluido')
  const atrasadas  = pendentes.filter(t => t.data && t.data < hoje)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-[12px]">
          <span className="text-[#9ca3af]">{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''}</span>
          {atrasadas.length > 0 && <span className="text-red-600 font-medium">· {atrasadas.length} em atraso</span>}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#145A5B] border border-[#145A5B]/30 rounded-xl hover:bg-[#f0f7f7] transition-colors">
          <Plus size={12} /> Nova tarefa
        </button>
      </div>

      {tarefas.length === 0
        ? <EmptyState icon={CheckSquare} msg="Nenhuma tarefa vinculada" />
        : (
          <div className="space-y-2">
            {pendentes.map(t => {
              const st    = STATUS_TAREFA[t.status] ?? STATUS_TAREFA.a_fazer
              const late  = t.data && t.data < hoje && t.status !== 'concluido'
              return (
                <div key={t.id} className={cn('flex items-start gap-3 p-3.5 rounded-xl border transition-colors', late ? 'border-red-200 bg-red-50/50' : 'border-[#f3f4f6] hover:bg-[#f9fafb]')}>
                  <CheckSquare size={14} className={cn('mt-0.5 shrink-0', late ? 'text-red-500' : 'text-[#9ca3af]')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0f1923]">{t.titulo}</p>
                    {t.data && (
                      <p className={cn('text-[11px] mt-0.5', late ? 'text-red-600 font-medium' : 'text-[#9ca3af]')}>
                        {late ? '⚠ Venceu em ' : ''}{fmtDate(t.data)}
                      </p>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', st.color)}>
                    {st.label}
                  </span>
                </div>
              )
            })}
            {concluidas.length > 0 && (
              <details className="mt-2">
                <summary className="text-[12px] text-[#9ca3af] cursor-pointer hover:text-[#374151] select-none py-1">
                  {concluidas.length} tarefa{concluidas.length !== 1 ? 's' : ''} concluída{concluidas.length !== 1 ? 's' : ''}
                </summary>
                <div className="space-y-2 mt-2">
                  {concluidas.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#f3f4f6] opacity-60">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <p className="text-[12px] text-[#6b7280] line-through">{t.titulo}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )
      }

      {showCreate && (
        <CriarTarefaModal
          processos={processos} profiles={profiles}
          onClose={() => setShowCreate(false)}
          onCreated={t => { onCreated(t); setShowCreate(false) }}
        />
      )}
    </div>
  )
}

// ── Aba Agenda ────────────────────────────────────────────────────────────────

function AgendaTab({ agenda, clienteId, processos, onCreated }: {
  agenda:    any[]
  clienteId: string
  processos: Props['processos']
  onCreated: (a: any) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const hoje = new Date().toISOString().slice(0, 10)

  const TIPO_AGE: Record<string, string> = {
    audiencia: 'bg-violet-50 text-violet-700',
    prazo:     'bg-amber-50 text-amber-700',
    reuniao:   'bg-blue-50 text-blue-700',
    tarefa:    'bg-slate-100 text-slate-600',
    evento:    'bg-teal-50 text-teal-700',
  }
  const TIPO_AGE_LABEL: Record<string, string> = {
    audiencia: 'Audiência', prazo: 'Prazo', reuniao: 'Reunião', tarefa: 'Tarefa', evento: 'Evento',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#9ca3af]">{agenda.length} evento{agenda.length !== 1 ? 's' : ''}</span>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#145A5B] border border-[#145A5B]/30 rounded-xl hover:bg-[#f0f7f7] transition-colors">
          <Plus size={12} /> Agendar
        </button>
      </div>

      {agenda.length === 0
        ? <EmptyState icon={Calendar} msg="Nenhum compromisso na agenda" />
        : (
          <div className="space-y-2">
            {agenda.map(ev => {
              const data  = ev.prazo_final ?? ev.data_fim ?? ev.data_inicio
              const late  = data && data < hoje && ev.status !== 'concluido'
              return (
                <div key={ev.id} className={cn('flex items-start gap-3 p-3.5 rounded-xl border transition-colors', late ? 'border-orange-200 bg-orange-50/50' : 'border-[#f3f4f6] hover:bg-[#f9fafb]')}>
                  <Calendar size={14} className={cn('mt-0.5 shrink-0', late ? 'text-orange-500' : 'text-[#9ca3af]')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0f1923]">{ev.titulo}</p>
                    <p className={cn('text-[11px] mt-0.5', late ? 'text-orange-600 font-medium' : 'text-[#9ca3af]')}>
                      {late ? '⚠ ' : ''}{fmtDate(data)}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', TIPO_AGE[ev.tipo] ?? 'bg-slate-100 text-slate-600')}>
                    {TIPO_AGE_LABEL[ev.tipo] ?? ev.tipo}
                  </span>
                </div>
              )
            })}
          </div>
        )
      }

      {showCreate && (
        <AgendarModal
          clienteId={clienteId} processos={processos}
          onClose={() => setShowCreate(false)}
          onCreated={a => { onCreated(a); setShowCreate(false) }}
        />
      )}
    </div>
  )
}

// ── Primitivos ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6]">
          <h3 className="text-[14px] font-bold text-[#0f1923]">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6] transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#145A5B] placeholder:text-[#c5cdd8]" />
    </div>
  )
}

function EmptyState({ icon: Icon, msg }: { icon: typeof Scale; msg: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3">
      <div className="w-12 h-12 bg-[#f3f4f6] rounded-2xl flex items-center justify-center">
        <Icon size={20} className="text-[#D0DCDC]" />
      </div>
      <p className="text-[13px] text-[#9ca3af]">{msg}</p>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value?: string | null; href?: string }) {
  if (!value) return null
  const content = (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-[#c5cdd8] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider">{label}</p>
        <p className="text-[13px] text-[#374151] mt-0.5 break-words">{value}</p>
      </div>
    </div>
  )
  if (href) return <a href={href} className="hover:text-[#145A5B] transition-colors block">{content}</a>
  return <div>{content}</div>
}

function TabButton({ active, onClick, children, count }: {
  active: boolean; onClick: () => void; children: ReactNode; count?: number
}) {
  return (
    <button onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all border-b-2 -mb-px',
        active
          ? 'text-[#145A5B] border-[#145A5B] bg-[#f0f7f7]'
          : 'text-[#9ca3af] border-transparent hover:text-[#374151] hover:bg-[#f9fafb]',
      )}>
      {children}
      {count !== undefined && (
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
          active ? 'bg-[#145A5B]/15 text-[#145A5B]' : 'bg-[#f3f4f6] text-[#9ca3af]')}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ClienteDetail({
  cliente, processos, interactions, tarefas, agenda, profiles, publicacoesPendentes,
}: Props) {
  const [editing,     setEditing]     = useState(false)
  const [tab,         setTab]         = useState<Tab>('historico')
  const [tarefasList, setTarefasList] = useState(tarefas)
  const [agendaList,  setAgendaList]  = useState(agenda)
  const router = useRouter()

  const dias      = diasSemContato(cliente.ultimo_contato)
  const whatsapp  = (cliente.celular ?? cliente.telefone ?? '').replace(/\D/g, '')
  const hoje      = new Date().toISOString().slice(0, 10)

  const tarefasAtrasadas = tarefasList.filter(t =>
    t.status !== 'concluido' && t.data && t.data < hoje
  ).length

  const tarefasAbertas = tarefasList.filter(t => t.status !== 'concluido').length

  const handleTarefaCriada = useCallback((t: any) => {
    setTarefasList(prev => [t, ...prev])
    setTab('tarefas')
  }, [])

  const handleAgendaCriada = useCallback((a: any) => {
    setAgendaList(prev => [a, ...prev])
    setTab('agenda')
  }, [])

  // ── Modo edição ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 text-[13px] text-[#6b7280] hover:text-[#0f1923] transition-colors">
            <ArrowLeft size={14} /> Voltar
          </button>
          <h1 className="text-[20px] font-semibold text-[#0f1923]">Editar Contato</h1>
        </div>
        <ClienteForm cliente={cliente} onSuccess={() => { setEditing(false); router.refresh() }} />
      </div>
    )
  }

  // ── Render principal ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-[#9ca3af]">
          <Link href="/clientes" className="hover:text-[#374151] flex items-center gap-1 transition-colors">
            <ArrowLeft size={11} /> Contatos
          </Link>
          <span>/</span>
          <span className="text-[#374151]">{cliente.nome}</span>
        </div>

        {/* Nome + badges + ações */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-[#E8F0F0] flex items-center justify-center shrink-0">
              {cliente.tipo_pessoa === 'juridica'
                ? <Building2 size={22} className="text-[#145A5B]" />
                : <User size={22} className="text-[#145A5B]" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] font-bold text-[#0f1923] tracking-tight">{cliente.nome}</h1>
                <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border', TIPO_COLORS[cliente.tipo_contato ?? 'cliente'])}>
                  {TIPO_LABELS[cliente.tipo_contato ?? 'cliente']}
                </span>
                {!cliente.ativo && (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    Inativo
                  </span>
                )}
              </div>
              {/* Tags */}
              {cliente.tags && cliente.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {cliente.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f0f7f7] text-[#145A5B] border border-[#145A5B]/15">
                      <Tag size={9} /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {whatsapp && (
              <a href={`https://wa.me/55${whatsapp}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-[#25d366] border border-[#25d366]/30 rounded-xl hover:bg-[#f0fdf4] transition-colors">
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
            {cliente.email && (
              <a href={`mailto:${cliente.email}`}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
                <Send size={13} /> E-mail
              </a>
            )}
            <button onClick={() => { setEditing(true) }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              <Edit size={13} /> Editar
            </button>
          </div>
        </div>

        {/* Alertas inteligentes */}
        <AlertaBanner
          dias={dias}
          tarefasAtrasadas={tarefasAtrasadas}
          publicacoesPendentes={publicacoesPendentes}
        />
      </div>

      {/* ── Layout 2 colunas ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">

        {/* ── Coluna esquerda ─────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Métricas */}
          <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                value={dias === null ? '—' : dias === 0 ? 'Hoje' : `${dias}d`}
                label="sem contato"
                color={diasColor(dias)}
                bg={dias !== null && dias > 60 ? 'bg-red-50' : dias !== null && dias > 30 ? 'bg-amber-50' : 'bg-[#f9fafb]'}
              />
              <MetricCard value={processos.length} label={`processo${processos.length !== 1 ? 's' : ''}`} />
              <MetricCard
                value={tarefasAbertas}
                label={`tarefa${tarefasAbertas !== 1 ? 's' : ''} abertas`}
                color={tarefasAtrasadas > 0 ? 'text-red-600' : 'text-[#0f1923]'}
              />
              <MetricCard value={interactions.length} label={`interaç${interactions.length !== 1 ? 'ões' : 'ão'}`} />
            </div>
          </div>

          {/* Botões de ação */}
          <div className="bg-white rounded-2xl border border-[#D0DCDC] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-2">
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Ações rápidas</p>
            <ActionBtn icon={CheckSquare} label="Criar tarefa" onClick={() => { setTab('tarefas') }} color="text-[#145A5B]" />
            <ActionBtn icon={Calendar} label="Agendar compromisso" onClick={() => { setTab('agenda') }} color="text-violet-600" />
            <ActionBtn icon={Clock} label="Registrar interação" onClick={() => { setTab('historico') }} color="text-blue-600" />
          </div>

          {/* Contato */}
          <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">📞 Contato</p>
            <InfoItem icon={Phone} label="Celular" value={cliente.celular}
              href={whatsapp ? `https://wa.me/55${whatsapp}` : undefined} />
            <InfoItem icon={Phone} label="Telefone" value={cliente.telefone} />
            <InfoItem icon={Mail}  label="E-mail"  value={cliente.email} href={cliente.email ? `mailto:${cliente.email}` : undefined} />
          </div>

          {/* Dados */}
          <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">📄 Dados</p>
            <InfoItem icon={FileText}  label="CPF / CNPJ" value={cliente.cpf_cnpj} />
            <InfoItem icon={Briefcase} label="Empresa"    value={cliente.empresa} />
            <InfoItem icon={Briefcase} label="Cargo"      value={cliente.cargo} />
            {(cliente as any).nome_fantasia && <InfoItem icon={Tag} label="Nome fantasia" value={(cliente as any).nome_fantasia} />}
            {(cliente as any).socio_representante && <InfoItem icon={User} label="Sócio / Rep." value={(cliente as any).socio_representante} />}
          </div>

          {/* Endereço */}
          {(cliente.endereco || cliente.cidade) && (
            <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">📍 Endereço</p>
              <InfoItem icon={MapPin} label="Logradouro"
                value={[cliente.endereco, cliente.numero, cliente.complemento].filter(Boolean).join(', ') || null} />
              <InfoItem icon={MapPin} label="Bairro"    value={cliente.bairro} />
              <InfoItem icon={MapPin} label="Cidade/UF" value={[cliente.cidade, cliente.uf].filter(Boolean).join(' - ') || null} />
              <InfoItem icon={MapPin} label="CEP"       value={cliente.cep} />
            </div>
          )}

          {/* Relacionamento */}
          <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">📊 Relacionamento</p>
            {cliente.responsavel && (
              <InfoItem icon={User} label="Responsável interno" value={(cliente.responsavel as any).nome} />
            )}
            <InfoItem icon={Clock} label="Cadastrado em" value={fmtDate(cliente.created_at)} />
            <InfoItem icon={Clock} label="Último contato"
              value={cliente.ultimo_contato ? fmtDate(cliente.ultimo_contato) : 'Nenhum registro'} />
            {dias !== null && (
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold',
                dias > 60 ? 'bg-red-50 text-red-700' :
                dias > 30 ? 'bg-amber-50 text-amber-700' :
                            'bg-[#f9fafb] text-[#374151]')}>
                <Clock size={13} />
                {dias === 0 ? 'Contato hoje' : `${dias} dias sem contato`}
              </div>
            )}
            {cliente.observacoes && (
              <div>
                <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider mb-1">Observações</p>
                <p className="text-[12px] text-[#374151] leading-relaxed">{cliente.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna direita ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#D0DCDC] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center gap-0.5 px-4 pt-1 border-b border-[#f3f4f6] overflow-x-auto">
            <TabButton active={tab === 'historico'} onClick={() => setTab('historico')} count={interactions.length}>
              <Clock size={13} /> Histórico
            </TabButton>
            <TabButton active={tab === 'processos'} onClick={() => setTab('processos')} count={processos.length}>
              <Scale size={13} /> Processos
            </TabButton>
            <TabButton active={tab === 'tarefas'} onClick={() => setTab('tarefas')} count={tarefasList.length}>
              <CheckSquare size={13} /> Tarefas
            </TabButton>
            <TabButton active={tab === 'agenda'} onClick={() => setTab('agenda')} count={agendaList.length}>
              <Calendar size={13} /> Agenda
            </TabButton>
          </div>

          {/* Conteúdo */}
          <div className="p-5 overflow-y-auto max-h-[calc(100vh-260px)]">
            {tab === 'historico' && (
              <HistoricoTab clienteId={cliente.id} initial={interactions} />
            )}
            {tab === 'processos' && (
              <ProcessosTab processos={processos} />
            )}
            {tab === 'tarefas' && (
              <TarefasTab
                tarefas={tarefasList}
                processos={processos}
                profiles={profiles}
                onCreated={handleTarefaCriada}
              />
            )}
            {tab === 'agenda' && (
              <AgendaTab
                agenda={agendaList}
                clienteId={cliente.id}
                processos={processos}
                onCreated={handleAgendaCriada}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mini-primitivos ────────────────────────────────────────────────────────────

function MetricCard({ value, label, color = 'text-[#0f1923]', bg = 'bg-[#f9fafb]' }: {
  value: string | number; label: string; color?: string; bg?: string
}) {
  return (
    <div className={cn('rounded-xl p-3 text-center border border-[#f3f4f6]', bg)}>
      <p className={cn('text-[22px] font-bold tabular-nums leading-none', color)}>{value}</p>
      <p className="text-[10px] text-[#9ca3af] mt-1.5 leading-tight">{label}</p>
    </div>
  )
}

function ActionBtn({ icon: Icon, label, onClick, color = 'text-[#374151]' }: {
  icon: typeof CheckSquare; label: string; onClick: () => void; color?: string
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f9fafb] border border-[#f3f4f6] hover:border-[#e5e7eb] transition-colors text-left">
      <Icon size={14} className={color} />
      <span className="text-[13px] font-medium text-[#374151]">{label}</span>
      <ChevronRight size={12} className="text-[#c5cdd8] ml-auto" />
    </button>
  )
}
