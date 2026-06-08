'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit, Scale, Phone, Mail, MessageCircle, MapPin,
  Clock, Plus, Trash2, User, Building2, Calendar, CheckSquare,
  Tag, Briefcase, Users,
} from 'lucide-react'
import type { Cliente, Processo, ContactInteraction, ClienteContato, TipoContato, TipoInteracao } from '@/types'
import ClienteForm from '../ClienteForm'
import ContatosEmpresaTab from './ContatosEmpresaTab'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoContato, string> = {
  cliente:         'Cliente',
  parte_contraria: 'Parte Contrária',
  parceiro:        'Parceiro',
  fornecedor:      'Fornecedor',
  comercial:       'Comercial',
}

const TIPO_COLORS: Record<TipoContato, string> = {
  cliente:         'bg-[#e6f4ee] text-[#1a7a45]',
  parte_contraria: 'bg-[#fef3c7] text-[#92400e]',
  parceiro:        'bg-[#ede9fe] text-[#5b21b6]',
  fornecedor:      'bg-[#e0f2fe] text-[#075985]',
  comercial:       'bg-[#fce7f3] text-[#9d174d]',
}

const INTERACAO_LABELS: Record<TipoInteracao, string> = {
  ligacao:         'Ligação',
  reuniao:         'Reunião',
  email:           'E-mail',
  mensagem:        'Mensagem',
  observacao:      'Observação',
  tarefa_concluida:'Tarefa concluída',
}

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

function diasSemContato(ultimoContato: string | null): number | null {
  if (!ultimoContato) return null
  return Math.floor((Date.now() - new Date(ultimoContato).getTime()) / 86_400_000)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Componentes utilitários ───────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-[#a8b3c4] mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[11px] text-[#a8b3c4] uppercase tracking-wider">{label}</p>
        <p className="text-[13px] text-[#1a1d23] mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function TabBtn({
  active, onClick, children, count,
}: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-lg transition-all ${
        active
          ? 'bg-[#1D5F60] text-white'
          : 'text-[#7a8899] hover:bg-[#f5f7fa] hover:text-[#0f1923]'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-[#E8F2F2] text-[#7a8899]'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Painel de Histórico de Interações ────────────────────────────────────────

function InteracoesTab({
  clienteId,
  initial,
}: {
  clienteId: string
  initial: ContactInteraction[]
}) {
  const [interactions, setInteractions] = useState<ContactInteraction[]>(initial)
  const [tipo, setTipo] = useState<TipoInteracao>('observacao')
  const [descricao, setDescricao] = useState('')
  const [saving, startSave] = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleAdd() {
    setError('')
    if (!descricao.trim()) { setError('Descreva a interação.'); return }
    startSave(async () => {
      const res = await fetch('/api/contact-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, tipo, descricao }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao salvar'); return }
      setInteractions(prev => [json, ...prev])
      setDescricao('')
    })
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/contact-interactions?id=${id}`, { method: 'DELETE' })
    setInteractions(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      {/* Formulário de nova interação */}
      <div className="bg-[#f9fafb] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoInteracao)}
            className="px-3 py-2 text-[13px] bg-white border border-[#E2DDD8] rounded-lg outline-none focus:border-[#0F3D3E] text-[#0f1923]"
          >
            {(Object.entries(INTERACAO_LABELS) as [TipoInteracao, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <p className="text-[12px] text-[#7a8899]">Registrar nova interação</p>
        </div>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva o que aconteceu..."
          rows={3}
          className="w-full px-3 py-2 text-[13px] bg-white border border-[#E2DDD8] rounded-lg outline-none focus:border-[#0F3D3E] placeholder:text-[#a8b3c4] resize-none"
        />
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          <Plus size={13} />
          {saving ? 'Salvando...' : 'Registrar'}
        </button>
      </div>

      {/* Timeline */}
      {interactions.length === 0 ? (
        <p className="text-[13px] text-[#a8b3c4] text-center py-8">Nenhuma interação registrada</p>
      ) : (
        <div className="space-y-2">
          {interactions.map((i) => (
            <div key={i.id} className="flex gap-3 p-3 rounded-xl hover:bg-[#f9fafb] group transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#E8F2F2] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock size={12} className="text-[#1D5F60]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#0F3D3E] uppercase tracking-wider">
                    {INTERACAO_LABELS[i.tipo]}
                  </span>
                  {i.usuario && (
                    <span className="text-[11px] text-[#a8b3c4]">por {(i.usuario as any).nome}</span>
                  )}
                  <span className="text-[11px] text-[#c5cdd8] ml-auto">{formatDateTime(i.created_at)}</span>
                </div>
                <p className="text-[13px] text-[#3d4a5c] mt-1 leading-relaxed">{i.descricao}</p>
              </div>
              <button
                onClick={() => handleDelete(i.id)}
                disabled={deleting === i.id}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-[#c5cdd8] hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5 disabled:opacity-30"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Painel de Processos ───────────────────────────────────────────────────────

function ProcessosTab({ processos }: { processos: Partial<Processo>[] }) {
  const statusColors: Record<string, string> = {
    ativo:     'bg-green-100 text-green-700',
    suspenso:  'bg-amber-100 text-amber-700',
    arquivado: 'bg-gray-100 text-gray-600',
    encerrado: 'bg-red-100 text-red-700',
  }
  return processos.length === 0 ? (
    <p className="text-[13px] text-[#a8b3c4] text-center py-8">Nenhum processo</p>
  ) : (
    <div className="space-y-2">
      {processos.map((p) => (
        <Link
          key={p.id}
          href={`/processos/${p.id}`}
          className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f9fafb] transition-colors"
        >
          <Scale size={14} className="text-[#7a8899] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#0f1923] truncate">{p.titulo}</p>
            {p.numero_processo && (
              <p className="text-[11px] text-[#a8b3c4] font-mono mt-0.5">{p.numero_processo}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-[#7a8899]">
                {AREA_LABELS[p.area_direito ?? ''] ?? p.area_direito}
              </span>
              {p.status && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Painel de Tarefas ────────────────────────────────────────────────────────

function TarefasTab({ tarefas }: { tarefas: any[] }) {
  return tarefas.length === 0 ? (
    <p className="text-[13px] text-[#a8b3c4] text-center py-8">Nenhuma tarefa</p>
  ) : (
    <div className="space-y-2">
      {tarefas.map((t) => (
        <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f9fafb] transition-colors">
          <CheckSquare size={14} className={`mt-0.5 flex-shrink-0 ${
            t.status === 'concluido' ? 'text-green-500' : 'text-[#7a8899]'
          }`} />
          <div className="flex-1">
            <p className={`text-[13px] font-medium ${t.status === 'concluido' ? 'line-through text-[#a8b3c4]' : 'text-[#0f1923]'}`}>
              {t.titulo}
            </p>
            {t.data && (
              <p className="text-[11px] text-[#a8b3c4] mt-0.5">{formatDate(t.data)}</p>
            )}
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full mt-0.5 ${
            t.status === 'concluido' ? 'bg-green-100 text-green-700' :
            t.status === 'fazendo'   ? 'bg-blue-100 text-blue-700' :
                                       'bg-gray-100 text-gray-600'
          }`}>
            {t.status === 'concluido' ? 'Concluído' : t.status === 'fazendo' ? 'Em andamento' : 'A fazer'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Painel de Agenda ─────────────────────────────────────────────────────────

function AgendaTab({ agenda }: { agenda: any[] }) {
  return agenda.length === 0 ? (
    <p className="text-[13px] text-[#a8b3c4] text-center py-8">Nenhum evento na agenda</p>
  ) : (
    <div className="space-y-2">
      {agenda.map((ev) => (
        <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f9fafb] transition-colors">
          <Calendar size={14} className="text-[#7a8899] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-[#0f1923]">{ev.titulo}</p>
            <p className="text-[11px] text-[#a8b3c4] mt-0.5">
              {formatDate(ev.data_inicio ?? ev.data_final)}
            </p>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full mt-0.5 ${
            ev.status === 'concluido' ? 'bg-green-100 text-green-700' :
            ev.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                                        'bg-blue-100 text-blue-700'
          }`}>
            {ev.tipo ?? ev.status ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

type Tab = 'processos' | 'tarefas' | 'agenda' | 'historico' | 'contatos'
type ClienteDetailProps = {
  cliente: Cliente
  processos: Partial<Processo>[]
  interactions: ContactInteraction[]
  tarefas: any[]
  agenda: any[]
  contatos: ClienteContato[]
  canEditContatos: boolean
}

export default function ClienteDetail({
  cliente,
  processos,
  interactions,
  tarefas,
  agenda,
  contatos,
  canEditContatos,
}: ClienteDetailProps) {
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<Tab>('historico')
  const router = useRouter()

  const dias = diasSemContato(cliente.ultimo_contato)
  const diasColor =
    dias === null        ? 'text-[#a8b3c4]' :
    dias <= 7            ? 'text-[#1a7a45]' :
    dias <= 30           ? 'text-[#d97706]' :
                           'text-[#dc2626]'

  const whatsapp = (cliente.celular ?? '').replace(/\D/g, '')

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
          <h1 className="text-xl font-semibold text-[#1a1d23]">Editar Contato</h1>
        </div>
        <ClienteForm cliente={cliente} onSuccess={() => { setEditing(false); router.refresh() }} />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/clientes"
            className="flex items-center gap-1.5 text-[13px] text-[#6b7280] hover:text-[#1a1d23] transition-colors"
          >
            <ArrowLeft size={14} /> Contatos
          </Link>
          <span className="text-[#d1d5db]">/</span>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">{cliente.nome}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${TIPO_COLORS[cliente.tipo_contato ?? 'cliente']}`}>
            {TIPO_LABELS[cliente.tipo_contato ?? 'cliente']}
          </span>
          {!cliente.ativo && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
              Inativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {whatsapp && (
            <a
              href={`https://wa.me/55${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[#25d366] border border-[#25d366]/30 rounded-xl hover:bg-[#e8fef2] transition-colors"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {cliente.email && (
            <a
              href={`mailto:${cliente.email}`}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[#3d4a5c] border border-[#E2DDD8] rounded-xl hover:bg-[#f5f7fa] transition-colors"
            >
              <Mail size={14} /> E-mail
            </a>
          )}
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[#3d4a5c] border border-[#E2DDD8] rounded-xl hover:bg-[#f5f7fa] transition-colors"
          >
            <Edit size={14} /> Editar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="grid grid-cols-[300px_1fr] gap-5">

        {/* Coluna esquerda */}
        <div className="space-y-4">

          {/* Avatar + métricas de relacionamento */}
          <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#E8F2F2] flex items-center justify-center flex-shrink-0">
                {cliente.tipo_pessoa === 'juridica'
                  ? <Building2 size={20} className="text-[#1D5F60]" />
                  : <User size={20} className="text-[#1D5F60]" />
                }
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0f1923]">{cliente.nome}</p>
                {cliente.cargo && <p className="text-[12px] text-[#7a8899]">{cliente.cargo}</p>}
                {cliente.empresa && <p className="text-[12px] text-[#7a8899]">{cliente.empresa}</p>}
              </div>
            </div>

            {/* Métricas de relacionamento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f5f7fa] rounded-xl p-3 text-center">
                <p className={`text-[22px] font-bold ${diasColor}`}>
                  {dias === null ? '—' : dias === 0 ? 'Hoje' : `${dias}d`}
                </p>
                <p className="text-[11px] text-[#a8b3c4] mt-0.5">sem contato</p>
              </div>
              <div className="bg-[#f5f7fa] rounded-xl p-3 text-center">
                <p className="text-[22px] font-bold text-[#0f1923]">{processos.length}</p>
                <p className="text-[11px] text-[#a8b3c4] mt-0.5">processo{processos.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-[#f5f7fa] rounded-xl p-3 text-center">
                <p className="text-[22px] font-bold text-[#0f1923]">{interactions.length}</p>
                <p className="text-[11px] text-[#a8b3c4] mt-0.5">interaç{interactions.length !== 1 ? 'ões' : 'ão'}</p>
              </div>
              <div className="bg-[#f5f7fa] rounded-xl p-3 text-center">
                <p className="text-[22px] font-bold text-[#0f1923]">
                  {tarefas.filter(t => t.status !== 'done').length}
                </p>
                <p className="text-[11px] text-[#a8b3c4] mt-0.5">tarefa{tarefas.filter(t => t.status !== 'done').length !== 1 ? 's' : ''} abertas</p>
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
            <p className="text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider">Contato</p>
            <InfoRow icon={Phone}  label="Celular"  value={cliente.celular} />
            <InfoRow icon={Phone}  label="Telefone" value={cliente.telefone} />
            <InfoRow icon={Mail}   label="E-mail"   value={cliente.email} />
          </div>

          {/* Dados */}
          <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
            <p className="text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider">Dados</p>
            <InfoRow icon={User}     label="CPF / CNPJ" value={cliente.cpf_cnpj} />
            <InfoRow icon={Briefcase} label="Empresa"   value={cliente.empresa} />
            <InfoRow icon={Briefcase} label="Cargo"     value={cliente.cargo} />
          </div>

          {/* Endereço */}
          {(cliente.endereco || cliente.cidade) && (
            <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
              <p className="text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider">Endereço</p>
              <InfoRow
                icon={MapPin}
                label="Logradouro"
                value={[cliente.endereco, cliente.numero, cliente.complemento].filter(Boolean).join(', ') || null}
              />
              <InfoRow icon={MapPin} label="Bairro"    value={cliente.bairro} />
              <InfoRow icon={MapPin} label="Cidade/UF" value={[cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || null} />
              <InfoRow icon={MapPin} label="CEP"       value={cliente.cep} />
            </div>
          )}

          {/* Responsável + tags */}
          <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
            <p className="text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider">Relacionamento</p>
            {cliente.responsavel && (
              <div className="flex items-center gap-2">
                <User size={13} className="text-[#a8b3c4]" />
                <div>
                  <p className="text-[11px] text-[#a8b3c4] uppercase tracking-wider">Responsável</p>
                  <p className="text-[13px] text-[#1a1d23] mt-0.5">{(cliente.responsavel as any).nome}</p>
                </div>
              </div>
            )}
            {cliente.tags && cliente.tags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag size={12} className="text-[#a8b3c4]" />
                  <p className="text-[11px] text-[#a8b3c4] uppercase tracking-wider">Tags</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cliente.tags.map((tag) => (
                    <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-[#E8F2F2] text-[#1D5F60]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {cliente.observacoes && (
              <div>
                <p className="text-[11px] text-[#a8b3c4] uppercase tracking-wider mb-1">Observações</p>
                <p className="text-[13px] text-[#3d4a5c] leading-relaxed">{cliente.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita */}
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center gap-1 px-5 py-3 border-b border-[#E2DDD8] bg-[#f9fafb]">
            <TabBtn active={tab === 'historico'} onClick={() => setTab('historico')} count={interactions.length}>
              <Clock size={13} /> Histórico
            </TabBtn>
            <TabBtn active={tab === 'contatos'} onClick={() => setTab('contatos')} count={contatos.length}>
              <Users size={13} /> Contatos
            </TabBtn>
            <TabBtn active={tab === 'processos'} onClick={() => setTab('processos')} count={processos.length}>
              <Scale size={13} /> Processos
            </TabBtn>
            <TabBtn active={tab === 'tarefas'} onClick={() => setTab('tarefas')} count={tarefas.length}>
              <CheckSquare size={13} /> Tarefas
            </TabBtn>
            <TabBtn active={tab === 'agenda'} onClick={() => setTab('agenda')} count={agenda.length}>
              <Calendar size={13} /> Agenda
            </TabBtn>
          </div>

          {/* Conteúdo da tab */}
          <div className="p-5 overflow-y-auto max-h-[calc(100vh-280px)]">
            {tab === 'historico' && (
              <InteracoesTab clienteId={cliente.id} initial={interactions} />
            )}
            {tab === 'contatos' && (
              <ContatosEmpresaTab
                clienteId={cliente.id}
                clienteNome={cliente.nome}
                pessoaJuridica={cliente.tipo_pessoa === 'juridica'}
                canEdit={canEditContatos}
                initialContatos={contatos}
              />
            )}
            {tab === 'processos' && <ProcessosTab processos={processos} />}
            {tab === 'tarefas'   && <TarefasTab tarefas={tarefas} />}
            {tab === 'agenda'    && <AgendaTab agenda={agenda} />}
          </div>
        </div>
      </div>
    </div>
  )
}
