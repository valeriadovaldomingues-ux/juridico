'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus, FileText, LayoutTemplate, Wand2, Pencil, Trash2,
  Copy, Check, Scale, Clock,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { can } from '@/lib/permissions'
import type { UserRole } from '@/types'
import ModeloModal, { TIPOS_DOCUMENTO, AREAS_DIREITO } from './ModeloModal'
import GeradorModal from './GeradorModal'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface DocModelo {
  id:             string
  nome:           string
  area_direito:   string | null
  tipo_documento: string
  descricao:      string | null
  conteudo:       string
  created_at:     string
}

interface DocGerado {
  id:          string
  titulo:      string
  conteudo:    string
  created_at:  string
  updated_at:  string
  modelo:      { nome: string } | null
  processo:    { id: string; titulo: string; numero_processo: string | null; advogado_responsavel?: { id: string; nome: string } | null } | null
}

interface ProcessoItem {
  id:                      string
  numero_processo:         string | null
  titulo:                  string
  area_direito:            string
  tribunal:                string | null
  vara:                    string | null
  valor_causa:             number | null
  advogado_responsavel_id: string | null
  cliente:                 { nome: string } | null
  partes_processo:         { pessoa_nome: string; tipo_parte: string }[]
  advogado_responsavel?:   { id: string; nome: string } | null
}

interface ProfileItem {
  id: string
  nome: string
}

interface Props {
  modelos:   DocModelo[]
  gerados:   DocGerado[]
  processos: ProcessoItem[]
  profiles:  ProfileItem[]
  role:      UserRole
}

type Aba = 'modelos' | 'gerados'

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DocumentosPage({ modelos: ini_m, gerados: ini_g, processos, profiles, role }: Props) {
  const [modelos, setModelos] = useState<DocModelo[]>(ini_m)
  const [gerados, setGerados] = useState<DocGerado[]>(ini_g)
  const [aba,     setAba]     = useState<Aba>('modelos')

  const [modeloModal, setModeloModal] = useState<{ open: boolean; editando: DocModelo | null }>({ open: false, editando: null })
  const [geradorModal,setGeradorModal]= useState<{ open: boolean; modeloId?: string }>({ open: false })

  const [excluindoModelo, setExcluindoModelo] = useState<string | null>(null)
  const [excluindoGerado, setExcluindoGerado] = useState<string | null>(null)
  const [visualizando,    setVisualizando]    = useState<DocGerado | null>(null)
  const [copiado,         setCopiado]         = useState<string | null>(null)

  const podeCriarModelo  = can(role, 'documentos', 'create') && ['advogado','gerente','socio'].includes(role)
  const podeEditarModelo = can(role, 'documentos', 'edit')   && ['advogado','gerente','socio'].includes(role)
  const podeExcluirModelo= can(role, 'documentos', 'delete') && ['gerente','socio'].includes(role)
  const podeCriarGerado  = can(role, 'documentos', 'create')
  const podeExcluirGerado= can(role, 'documentos', 'delete')

  // ── Handlers modelos ────────────────────────────────────────────────────────

  async function salvarModelo(data: any): Promise<string | null> {
    const isEdicao = !!modeloModal.editando?.id
    const url  = isEdicao ? `/api/documentos/modelos/${modeloModal.editando!.id}` : '/api/documentos/modelos'
    const method = isEdicao ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); return e.error ?? 'Erro ao salvar' }
    const saved = await res.json()
    if (isEdicao) setModelos(prev => prev.map(m => m.id === saved.id ? saved : m))
    else setModelos(prev => [saved, ...prev])
    setModeloModal({ open: false, editando: null })
    return null
  }

  async function excluirModelo(id: string) {
    setExcluindoModelo(id)
    const res = await fetch(`/api/documentos/modelos/${id}`, { method: 'DELETE' })
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error ?? 'Erro ao excluir') }
    else setModelos(prev => prev.filter(m => m.id !== id))
    setExcluindoModelo(null)
  }

  // ── Handlers gerados ────────────────────────────────────────────────────────

  async function salvarGerado(data: any): Promise<string | null> {
    const res = await fetch('/api/documentos/gerados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); return e.error ?? 'Erro ao salvar' }
    const saved = await res.json()
    setGerados(prev => [saved, ...prev])
    setGeradorModal({ open: false })
    setAba('gerados')
    return null
  }

  async function excluirGerado(id: string) {
    setExcluindoGerado(id)
    const res = await fetch(`/api/documentos/gerados/${id}`, { method: 'DELETE' })
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error ?? 'Erro ao excluir') }
    else setGerados(prev => prev.filter(g => g.id !== id))
    setExcluindoGerado(null)
  }

  async function copiarConteudo(id: string, conteudo: string) {
    await navigator.clipboard.writeText(conteudo)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  // ── Labels ──────────────────────────────────────────────────────────────────

  function labelTipo(v: string) {
    return TIPOS_DOCUMENTO.find(t => t.value === v)?.label ?? v.replace(/_/g, ' ')
  }
  function labelArea(v: string | null) {
    if (!v) return null
    return AREAS_DIREITO.find(a => a.value === v)?.label ?? v
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <FileText size={20} className="text-[#1D5F60]" />
            Documentos
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">Modelos e geração automática de documentos jurídicos</p>
        </div>
        <div className="flex gap-2">
          {podeCriarGerado && (
            <Link
              href="/documentos/gerador"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1B2A4E] hover:bg-[#25365F] text-white text-[13px] font-medium rounded-xl transition-colors shadow-sm"
            >
              <Wand2 size={14} />
              Gerador Inteligente
            </Link>
          )}
          {podeCriarGerado && (
            <button
              onClick={() => setGeradorModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#145A5B]/10 hover:bg-[#145A5B]/20 text-[#1D5F60] text-[13px] font-medium rounded-xl transition-colors border border-[#145A5B]/20"
            >
              <Wand2 size={14} />
              Gerar Documento
            </button>
          )}
          {podeCriarModelo && (
            <button
              onClick={() => setModeloModal({ open: true, editando: null })}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-xl transition-colors shadow-sm"
            >
              <Plus size={15} />
              Novo Modelo
            </button>
          )}
        </div>
      </div>

      {/* Container com abas */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

        {/* Tab nav */}
        <div className="flex border-b border-[#f3f4f6]">
          {([
            { id: 'modelos' as Aba, label: 'Modelos', icon: LayoutTemplate, count: modelos.length },
            { id: 'gerados' as Aba, label: 'Documentos Gerados', icon: FileText, count: gerados.length },
          ]).map(tab => {
            const Icon  = tab.icon
            const ativo = aba === tab.id
            return (
              <button key={tab.id} onClick={() => setAba(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-5 py-3.5 text-[13px] font-medium transition-all border-b-2 -mb-px',
                  ativo ? 'border-[#145A5B] text-[#1D5F60] bg-[#f0f7f7]' : 'border-transparent text-[#7a8899] hover:text-[#374151] hover:bg-[#f9fafb]',
                )}
              >
                <Icon size={14} />
                {tab.label}
                <span className={cn('ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold', ativo ? 'bg-[#145A5B]/10 text-[#1D5F60]' : 'bg-[#f3f4f6] text-[#9ca3af]')}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Tab Modelos ─────────────────────────────────────────────────── */}
        {aba === 'modelos' && (
          modelos.length === 0 ? (
            <div className="py-20 text-center">
              <LayoutTemplate size={32} className="mx-auto text-[#D0DCDC] mb-3" />
              <p className="text-[13px] text-[#9ca3af]">Nenhum modelo cadastrado</p>
              {podeCriarModelo && (
                <button onClick={() => setModeloModal({ open: true, editando: null })}
                  className="mt-3 text-[12px] text-[#1D5F60] font-semibold hover:underline">
                  Criar primeiro modelo →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#f5f7fa]">
              {modelos.map(m => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#fafbfb] transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F2F2] flex items-center justify-center shrink-0">
                    <LayoutTemplate size={16} className="text-[#1D5F60]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0f1923]">{m.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-[#9ca3af]">{labelTipo(m.tipo_documento)}</span>
                      {labelArea(m.area_direito) && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F2F2] text-[#1D5F60]">
                          {labelArea(m.area_direito)}
                        </span>
                      )}
                      {m.descricao && (
                        <span className="text-[11px] text-[#c5cdd8] truncate max-w-xs">· {m.descricao}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {podeCriarGerado && (
                      <button
                        onClick={() => setGeradorModal({ open: true, modeloId: m.id })}
                        title="Gerar documento a partir deste modelo"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#1D5F60] bg-[#E8F2F2] hover:bg-[#D0DCDC] rounded-lg transition-colors"
                      >
                        <Wand2 size={11} /> Gerar
                      </button>
                    )}
                    {podeEditarModelo && (
                      <button onClick={() => setModeloModal({ open: true, editando: m })}
                        title="Editar modelo"
                        className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                    {podeExcluirModelo && (
                      <button onClick={() => excluirModelo(m.id)} disabled={excluindoModelo === m.id}
                        title="Excluir modelo"
                        className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-[#c5cdd8] shrink-0">
                    {formatDate(m.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Tab Gerados ──────────────────────────────────────────────────── */}
        {aba === 'gerados' && (
          gerados.length === 0 ? (
            <div className="py-20 text-center">
              <FileText size={32} className="mx-auto text-[#D0DCDC] mb-3" />
              <p className="text-[13px] text-[#9ca3af]">Nenhum documento gerado ainda</p>
              {podeCriarGerado && (
                <button onClick={() => setGeradorModal({ open: true })}
                  className="mt-3 text-[12px] text-[#1D5F60] font-semibold hover:underline">
                  Gerar primeiro documento →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#f5f7fa]">
              {gerados.map(g => (
                <div key={g.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#fafbfb] transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-[#fef3e2] flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-[#b8903a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0f1923]">{g.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {g.processo && (
                        <span className="flex items-center gap-1 text-[11px] text-[#9ca3af]">
                          <Scale size={10} />
                          {g.processo.numero_processo ?? g.processo.titulo}
                        </span>
                      )}
                      {g.modelo && (
                        <span className="text-[11px] text-[#c5cdd8]">· {g.modelo.nome}</span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-[#c5cdd8]">
                        <Clock size={10} /> {formatDate(g.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setVisualizando(g)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors">
                      Visualizar
                    </button>
                    <button onClick={() => copiarConteudo(g.id, g.conteudo)}
                      title="Copiar texto"
                      className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                      {copiado === g.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                    {podeExcluirGerado && (
                      <button onClick={() => excluirGerado(g.id)} disabled={excluindoGerado === g.id}
                        title="Excluir" className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Visualizador de documento */}
      {visualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] shrink-0">
              <div>
                <h2 className="text-[14px] font-semibold text-[#0f1923]">{visualizando.titulo}</h2>
                {visualizando.processo && (
                  <p className="text-[11px] text-[#9ca3af] mt-0.5">{visualizando.processo.numero_processo ?? visualizando.processo.titulo}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copiarConteudo(visualizando.id, visualizando.conteudo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors">
                  {copiado === visualizando.id ? <><Check size={12} className="text-green-500" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                </button>
                <button onClick={() => setVisualizando(null)}
                  className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap text-[13px] text-[#374151] leading-relaxed font-sans">{visualizando.conteudo}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modelo */}
      {modeloModal.open && (
        <ModeloModal
          modelo={modeloModal.editando}
          onSalvar={salvarModelo}
          onFechar={() => setModeloModal({ open: false, editando: null })}
        />
      )}

      {/* Modal gerador */}
      {geradorModal.open && (
        <GeradorModal
          modelos={modelos}
          processos={processos}
          profiles={profiles}
          modeloInicial={geradorModal.modeloId}
          onSalvar={salvarGerado}
          onFechar={() => setGeradorModal({ open: false })}
        />
      )}
    </div>
  )
}

function X({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
