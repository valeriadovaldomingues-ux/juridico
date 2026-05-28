'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit, Users, CalendarDays,
  Plus, Trash2, Pencil, X, Check, Loader2,
  ExternalLink,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { ParteProcesso, Prazo } from '@/types'
import ProcessoForm from '../ProcessoForm'

// ─── Labels e cores ───────────────────────────────────────────────────────────

const areaLabels: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família', empresarial: 'Empresarial', outro: 'Outro',
}

const statusColors: Record<string, string> = {
  ativo:     'bg-green-100 text-green-700',
  suspenso:  'bg-amber-100 text-amber-700',
  arquivado: 'bg-gray-100 text-gray-600',
  encerrado: 'bg-red-100 text-red-700',
}

const prioridadeColors: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-amber-100 text-amber-700',
  media:   'bg-blue-100 text-blue-700',
  baixa:   'bg-gray-100 text-gray-600',
}

const tipoParteLabel: Record<string, string> = {
  autor:    'Autor',
  reu:      'Réu',
  terceiro: 'Terceiro',
  outro:    'Outro',
}

// Badges das partes — cores suaves, leitura clara, aspecto premium
const tipoParteBadge: Record<string, string> = {
  autor:    'bg-sky-50 text-sky-600 ring-1 ring-sky-200/70',
  reu:      'bg-rose-50 text-rose-600 ring-1 ring-rose-200/70',
  terceiro: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/70',
  outro:    'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/70',
}

// Ordem de exibição das partes
const TIPO_ORDEM = ['autor', 'reu', 'terceiro', 'outro']

const OFFICIAL_PROCESS_LINKS = [
  { nome: 'PJe', href: 'https://www.pje.jus.br/' },
  { nome: 'eproc', href: 'https://eproc.jus.br/eproc/' },
  { nome: 'ESAJ', href: 'https://esaj.tjsp.jus.br/' },
  { nome: 'Projudi', href: 'https://projudi.tjpr.jus.br/projudi/' },
  { nome: 'DJEN/CNJ', href: 'https://comunica.pje.jus.br/' },
]

// ─── Tipos internos ───────────────────────────────────────────────────────────

type TipoParte = 'autor' | 'reu' | 'terceiro' | 'outro'

interface ParteForm {
  pessoa_nome: string
  tipo_parte: TipoParte
  documento: string
  observacoes: string
}

const FORM_VAZIO: ParteForm = {
  pessoa_nome: '',
  tipo_parte:  'reu',
  documento:   '',
  observacoes: '',
}

interface AgendaItemSimple {
  id: string
  titulo: string
  tipo: string
  status: string
  data_inicio: string
  hora_inicio?: string
  prazo_final?: string
  prioridade: string
}

interface ClienteSimple {
  id: string
  nome: string
  celular?: string | null
  email?: string | null
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProcessoDetail({
  processo,
  partes: partesIniciais,
  prazos,
  clientes,
  agendaItems = [],
}: {
  processo: any
  partes: ParteProcesso[]
  prazos: Prazo[]
  clientes: { id: string; nome: string }[]
  agendaItems?: AgendaItemSimple[]
}) {
  const [editing, setEditing] = useState(false)
  const router = useRouter()

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#1a1d23] transition-colors"
          >
            <ArrowLeft size={15} /> Voltar
          </button>
          <h1 className="text-xl font-semibold text-[#1a1d23]">Editar Processo</h1>
        </div>
        <ProcessoForm
          processo={processo}
          clientes={clientes}
          parteContraria={partesIniciais[0] ?? null}
          onSuccess={() => { setEditing(false); router.refresh() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/processos"
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#1a1d23] transition-colors"
          >
            <ArrowLeft size={15} /> Processos
          </Link>
          <span className="text-[#d1d5db]">/</span>
          <h1 className="text-xl font-semibold text-[#1a1d23]">{processo.titulo}</h1>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#e5e7eb] text-sm font-medium text-[#374151] rounded-xl hover:bg-[#f9fafb] transition-colors"
        >
          <Edit size={14} /> Editar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* ── Coluna principal ── */}
        <div className="col-span-2 space-y-4">

          {/* Dados do processo */}
          <div className="bg-white rounded-lg border border-[#e5e7eb] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1a1d23]">Dados do Processo</h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[processo.status] ?? 'bg-gray-100'}`}>
                {processo.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Número do Processo" value={processo.numero_processo} mono />
              <Field label="Área do Direito"     value={areaLabels[processo.area_direito] ?? processo.area_direito} />
              <Field label="Tribunal"             value={processo.tribunal} />
              <Field label="Vara"                 value={processo.vara} />
              <Field label="Fase"                 value={processo.fase} />
              <Field label="Distribuição"         value={processo.data_distribuicao ? formatDate(processo.data_distribuicao) : null} />
              <Field label="Valor da Causa"       value={processo.valor_causa ? formatCurrency(processo.valor_causa) : null} />
            </div>
            {processo.observacoes && (
              <div className="mt-4 pt-4 border-t border-[#f3f4f6]">
                <p className="text-xs text-[#9ca3af] uppercase tracking-wider mb-1.5">Observações</p>
                <p className="text-sm text-[#374151]">{processo.observacoes}</p>
              </div>
            )}
          </div>

          {/* Partes do processo — visual + CRUD inline */}
          <PartesSection
            processoId={processo.id}
            partesIniciais={partesIniciais}
            cliente={processo.cliente ?? null}
            onEditar={() => setEditing(true)}
          />
        </div>

        {/* ── Coluna lateral ── */}
        <div className="space-y-4">

          {/* Prazos */}
          <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
            <h2 className="text-xs text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-2">
              <CalendarDays size={12} /> Prazos ({prazos.length})
            </h2>
            {prazos.length === 0 ? (
              <p className="text-sm text-[#9ca3af]">Nenhum prazo</p>
            ) : (
              <div className="space-y-2.5">
                {prazos.map((prazo) => (
                  <div key={prazo.id} className="p-2.5 rounded-xl bg-[#f9fafb]">
                    <p className="text-sm font-medium text-[#1a1d23] leading-tight">{prazo.titulo}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-[#9ca3af]">{formatDate(prazo.data_final)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${prioridadeColors[prazo.prioridade] ?? 'bg-gray-100 text-gray-600'}`}>
                        {prazo.prioridade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agenda / Timeline */}
          <AgendaTimeline processoId={processo.id} items={agendaItems} />

          <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
            <h2 className="text-xs text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-2">
              <ExternalLink size={12} /> Sistemas oficiais
            </h2>
            <div className="flex flex-wrap gap-2">
              {OFFICIAL_PROCESS_LINKS.map(link => (
                <a
                  key={link.nome}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-[12px] font-medium text-[#1D5F60] hover:border-[#1D5F60] transition-colors"
                >
                  {link.nome} <ExternalLink size={11} />
                </a>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#7a8899]">
              Atalhos abrem os sistemas oficiais em nova aba. O sistema nao preenche login, nao captura cookie e nao salva sessao.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Seção de Partes (visual + CRUD inline) ───────────────────────────────────

function PartesSection({
  processoId,
  partesIniciais,
  cliente,
  onEditar,
}: {
  processoId: string
  partesIniciais: ParteProcesso[]
  cliente: ClienteSimple | null
  onEditar: () => void
}) {
  const [partes, setPartes]           = useState<ParteProcesso[]>(partesIniciais)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<ParteForm>(FORM_VAZIO)
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState('')

  const supabase = createClient()

  const partesOrdenadas = [...partes].sort(
    (a, b) => TIPO_ORDEM.indexOf(a.tipo_parte) - TIPO_ORDEM.indexOf(b.tipo_parte)
  )

  // Total de partes incluindo cliente principal
  const totalPartes = (cliente ? 1 : 0) + partes.length

  function abrirAddForm() {
    setEditingId(null)
    setForm(FORM_VAZIO)
    setErro('')
    setShowAddForm(true)
  }

  function abrirEditForm(parte: ParteProcesso) {
    setShowAddForm(false)
    setEditingId(parte.id)
    setForm({
      pessoa_nome: parte.pessoa_nome,
      tipo_parte:  parte.tipo_parte as TipoParte,
      documento:   parte.documento ?? '',
      observacoes: parte.observacoes ?? '',
    })
    setErro('')
  }

  function cancelar() {
    setShowAddForm(false)
    setEditingId(null)
    setForm(FORM_VAZIO)
    setErro('')
  }

  async function salvarNova() {
    if (!form.pessoa_nome.trim()) { setErro('Nome obrigatório'); return }
    setSaving(true); setErro('')
    const { data, error } = await supabase
      .from('partes_processo')
      .insert({
        processo_id: processoId,
        pessoa_nome: form.pessoa_nome.trim(),
        tipo_parte:  form.tipo_parte,
        documento:   form.documento.trim() || null,
        observacoes: form.observacoes.trim() || null,
      })
      .select()
      .single()

    setSaving(false)
    if (error) { setErro(error.message); return }
    setPartes(prev => [...prev, data as ParteProcesso])
    cancelar()
  }

  async function salvarEdicao() {
    if (!form.pessoa_nome.trim()) { setErro('Nome obrigatório'); return }
    if (!editingId) return
    setSaving(true); setErro('')
    const { data, error } = await supabase
      .from('partes_processo')
      .update({
        pessoa_nome: form.pessoa_nome.trim(),
        tipo_parte:  form.tipo_parte,
        documento:   form.documento.trim() || null,
        observacoes: form.observacoes.trim() || null,
      })
      .eq('id', editingId)
      .select()
      .single()

    setSaving(false)
    if (error) { setErro(error.message); return }
    setPartes(prev => prev.map(p => p.id === editingId ? (data as ParteProcesso) : p))
    cancelar()
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Remover "${nome}" das partes?`)) return
    const res = await fetch(`/api/partes-processo/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Sem permissão para remover esta parte')
      return
    }
    setPartes(prev => prev.filter(p => p.id !== id))
  }

  const crudAtivo = showAddForm || editingId !== null

  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
        <h2 className="text-sm font-semibold text-[#1a1d23] flex items-center gap-2">
          <Users size={14} className="text-[#6b7280]" />
          Partes do Processo
          <span className="text-xs font-normal text-[#9ca3af]">({totalPartes})</span>
        </h2>
        {!crudAtivo && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEditar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors"
            >
              <Edit size={11} /> Editar partes
            </button>
            <button
              onClick={abrirAddForm}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1D5F60] bg-[#E8F2F2] hover:bg-[#d0e5e5] rounded-lg transition-colors"
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>
        )}
      </div>

      {/* ── Lista de partes ── */}
      <div>

        {/* ── Grupo: Cliente ── */}
        {cliente && (
          <div>
            <div className="px-6 pt-4 pb-2">
              <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                Cliente
              </span>
            </div>
            <div className="flex items-center gap-4 px-6 pb-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#E8F2F2] flex items-center justify-center">
                <span className="text-[12px] font-bold text-[#1D5F60] leading-none select-none">
                  {cliente.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/clientes/${cliente.id}`} className="group inline-flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[#111827] group-hover:text-[#1D5F60] transition-colors leading-tight">
                    {cliente.nome}
                  </span>
                  <ExternalLink size={11} className="text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
                {(cliente.celular || cliente.email) && (
                  <p className="text-xs text-[#9ca3af] mt-0.5 truncate">
                    {cliente.celular ?? cliente.email}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[11px] font-medium tracking-wide px-2.5 py-0.5 rounded-full bg-[#E8F2F2] text-[#1D5F60] ring-1 ring-[#c5dede]/60">
                Cliente
              </span>
            </div>
          </div>
        )}

        {/* Divisor entre cliente e partes */}
        <div className="mx-6 border-t border-[#f3f4f6]" />

        {/* ── Grupo: Partes Contrárias ── */}
        <div className="px-6 pt-4 pb-2">
          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">
            {partesOrdenadas.length === 1 ? 'Parte Contrária' : 'Partes Contrárias'}
          </span>
        </div>

        <div className="divide-y divide-[#f9fafb]">

        {/* Estado vazio */}
        {partesOrdenadas.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
            <div className="w-9 h-9 rounded-full bg-[#f3f4f6] flex items-center justify-center mb-0.5">
              <Users size={15} className="text-[#d1d5db]" />
            </div>
            <p className="text-sm font-medium text-[#6b7280]">Nenhuma parte contrária cadastrada</p>
            <p className="text-xs text-[#9ca3af]">Adicione as partes envolvidas neste processo</p>
            <button
              onClick={abrirAddForm}
              className="mt-1 text-xs font-semibold text-[#1D5F60] hover:underline inline-flex items-center gap-1"
            >
              <Plus size={11} /> Adicionar parte
            </button>
          </div>
        )}

        {partesOrdenadas.map((parte) => {
          if (editingId === parte.id) {
            return (
              <div key={parte.id} className="px-6 py-4 bg-[#f9fafb]">
                <ParteFormUI
                  form={form}
                  onChange={setForm}
                  onSave={salvarEdicao}
                  onCancel={cancelar}
                  saving={saving}
                  erro={erro}
                  titulo="Editar parte"
                />
              </div>
            )
          }

          return (
            <div key={parte.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#fafafa] group transition-colors">
              {/* Avatar inicial */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#f3f4f6] flex items-center justify-center">
                <span className="text-[12px] font-bold text-[#9ca3af] leading-none select-none">
                  {parte.pessoa_nome.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Dados */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111827] leading-tight truncate">
                  {parte.pessoa_nome}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {parte.documento && (
                    <span className="text-[11px] text-[#9ca3af] font-mono">{parte.documento}</span>
                  )}
                  {parte.documento && parte.observacoes && (
                    <span className="text-[#e5e7eb]">·</span>
                  )}
                  {parte.observacoes && (
                    <span className="text-[11px] text-[#9ca3af] truncate">{parte.observacoes}</span>
                  )}
                </div>
              </div>

              {/* Badge papel */}
              <span className={`shrink-0 text-[11px] font-medium tracking-wide px-2.5 py-0.5 rounded-full opacity-80 group-hover:opacity-100 transition-opacity ${tipoParteBadge[parte.tipo_parte] ?? 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/70'}`}>
                {tipoParteLabel[parte.tipo_parte] ?? parte.tipo_parte}
              </span>

              {/* Ações inline */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => abrirEditForm(parte)}
                  className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => excluir(parte.id, parte.pessoa_nome)}
                  className="p-1.5 rounded-lg text-[#9ca3af] hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remover"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Formulário de nova parte */}
        {showAddForm && (
          <div className="px-6 py-4 bg-[#f9fafb]">
            <ParteFormUI
              form={form}
              onChange={setForm}
              onSave={salvarNova}
              onCancel={cancelar}
              saving={saving}
              erro={erro}
              titulo="Nova parte"
            />
          </div>
        )}
        </div>{/* /divide-y partes */}
      </div>{/* /outer */}
    </div>
  )
}

// ─── Formulário reutilizável (add / edit) ─────────────────────────────────────

function ParteFormUI({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  erro,
  titulo,
}: {
  form: ParteForm
  onChange: (f: ParteForm) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  erro: string
  titulo: string
}) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-semibold text-[#374151]">{titulo}</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Nome */}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            value={form.pessoa_nome}
            onChange={e => onChange({ ...form, pessoa_nome: e.target.value })}
            placeholder="Nome completo da parte"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#d1d5db] transition-colors"
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Tipo</label>
          <select
            value={form.tipo_parte}
            onChange={e => onChange({ ...form, tipo_parte: e.target.value as TipoParte })}
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151] transition-colors"
          >
            <option value="reu">Réu</option>
            <option value="autor">Autor</option>
            <option value="terceiro">Terceiro</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        {/* Documento */}
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">CPF / CNPJ</label>
          <input
            value={form.documento}
            onChange={e => onChange({ ...form, documento: e.target.value })}
            placeholder="Opcional"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#d1d5db] font-mono transition-colors"
          />
        </div>

        {/* Observações */}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Observações</label>
          <input
            value={form.observacoes}
            onChange={e => onChange({ ...form, observacoes: e.target.value })}
            placeholder="Opcional"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#d1d5db] transition-colors"
          />
        </div>
      </div>

      {erro && <p className="text-[12px] text-red-500">{erro}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#6b7280] hover:text-[#1a1d23] rounded-lg hover:bg-[#f3f4f6] transition-colors"
        >
          <X size={13} /> Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Agenda Timeline ──────────────────────────────────────────────────────────

const TIPO_CHIP: Record<string, string> = {
  tarefa:    'bg-slate-100 text-slate-600',
  evento:    'bg-blue-50 text-blue-600',
  prazo:     'bg-orange-50 text-orange-600',
  audiencia: 'bg-rose-50 text-rose-600',
}
const TIPO_LABEL: Record<string, string> = {
  tarefa: 'Tarefa', evento: 'Evento', prazo: 'Prazo', audiencia: 'Audiência',
}

function AgendaTimeline({
  processoId,
  items,
}: {
  processoId: string
  items: AgendaItemSimple[]
}) {
  const pending   = items.filter(i => i.status === 'pendente')
  const concluded = items.filter(i => i.status !== 'pendente')

  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs text-[#9ca3af] uppercase tracking-wider flex items-center gap-2">
          <CalendarDays size={12} /> Agenda ({items.length})
        </h2>
        <Link
          href={`/agenda?processo=${processoId}`}
          className="text-[11px] font-semibold text-[#1D5F60] hover:underline"
        >
          Ver tudo
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-[#9ca3af]">Nenhum item na agenda</p>
          <Link
            href="/agenda"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1D5F60] hover:underline"
          >
            <Plus size={11} /> Adicionar
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {pending.map(item => {
            const today  = new Date().toISOString().split('T')[0]
            const ref    = item.prazo_final ?? item.data_inicio
            const overdue = item.status === 'pendente' && ref < today
            return (
              <div key={item.id} className={`flex items-start gap-2 p-2 rounded-xl ${overdue ? 'bg-red-50' : 'bg-[#f9fafb]'}`}>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${TIPO_CHIP[item.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                  {TIPO_LABEL[item.tipo] ?? item.tipo}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#1a1d23] leading-tight truncate">{item.titulo}</p>
                  <p className={`text-[10px] mt-0.5 ${overdue ? 'text-red-500 font-semibold' : 'text-[#9ca3af]'}`}>
                    {item.data_inicio.split('-').reverse().join('/')}
                    {item.hora_inicio && ` · ${item.hora_inicio.slice(0, 5)}`}
                    {overdue && ' · Vencido'}
                  </p>
                </div>
              </div>
            )
          })}
          {concluded.length > 0 && (
            <p className="text-[11px] text-[#9ca3af] pt-1 text-center">
              +{concluded.length} concluído{concluded.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Campo de exibição ────────────────────────────────────────────────────────

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[#9ca3af] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm text-[#374151] ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )
}
