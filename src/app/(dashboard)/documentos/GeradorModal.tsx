'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Copy, Check, ChevronRight, Wand2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface DocModelo {
  id:            string
  nome:          string
  tipo_documento:string
  area_direito:  string | null
  conteudo:      string
}

interface ProcessoItem {
  id:                    string
  numero_processo:       string | null
  titulo:                string
  area_direito:          string
  tribunal:              string | null
  vara:                  string | null
  valor_causa:           number | null
  advogado_responsavel_id: string | null
  cliente:               { nome: string } | null
  partes_processo:       { pessoa_nome: string; tipo_parte: string }[]
}

interface ProfileItem { id: string; nome: string }

interface Props {
  modelos:      DocModelo[]
  processos:    ProcessoItem[]
  profiles:     ProfileItem[]
  modeloInicial?: string
  onSalvar:     (data: { modelo_id: string | null; processo_id: string; titulo: string; conteudo: string }) => Promise<string | null>
  onFechar:     () => void
}

function preencherTemplate(conteudo: string, p: ProcessoItem, advNome: string): string {
  const parteContraria = p.partes_processo
    .filter(pp => ['reu', 'outro', 'terceiro'].includes(pp.tipo_parte))
    .map(pp => pp.pessoa_nome)
    .join(', ') || '[PARTE CONTRÁRIA]'

  const areaLabel: Record<string, string> = {
    civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
    tributario: 'Tributário', previdenciario: 'Previdenciário',
    administrativo: 'Administrativo', familia: 'Família', empresarial: 'Empresarial', outro: 'Outro',
  }

  return conteudo
    .replace(/\{\{cliente_nome\}\}/g,         p.cliente?.nome ?? '[CLIENTE]')
    .replace(/\{\{parte_contraria\}\}/g,       parteContraria)
    .replace(/\{\{numero_processo\}\}/g,       p.numero_processo ?? '[NÚMERO DO PROCESSO]')
    .replace(/\{\{vara\}\}/g,                  p.vara ?? '[VARA]')
    .replace(/\{\{tribunal\}\}/g,              p.tribunal ?? '[TRIBUNAL]')
    .replace(/\{\{valor_causa\}\}/g,           p.valor_causa ? formatCurrency(p.valor_causa) : '[VALOR DA CAUSA]')
    .replace(/\{\{area_direito\}\}/g,          areaLabel[p.area_direito] ?? p.area_direito)
    .replace(/\{\{advogado_responsavel\}\}/g,  advNome || '[ADVOGADO]')
    .replace(/\{\{data_atual\}\}/g,            new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }))
}

export default function GeradorModal({ modelos, processos, profiles, modeloInicial, onSalvar, onFechar }: Props) {
  const [step,       setStep]       = useState<'select' | 'edit'>('select')
  const [modeloId,   setModeloId]   = useState(modeloInicial ?? '')
  const [processoId, setProcessoId] = useState('')
  const [titulo,     setTitulo]     = useState('')
  const [conteudo,   setConteudo]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [erro,       setErro]       = useState('')
  const [copiado,    setCopiado]    = useState(false)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  const modelo   = modelos.find(m => m.id === modeloId)   ?? null
  const processo = processos.find(p => p.id === processoId) ?? null

  // Auto-gera título quando seleciona modelo e processo
  useEffect(() => {
    if (modelo && processo) {
      setTitulo(`${modelo.nome} — ${processo.numero_processo ?? processo.titulo}`)
    }
  }, [modeloId, processoId, modelo, processo])

  function gerarConteudo() {
    if (!modelo || !processo) { setErro('Selecione modelo e processo'); return }
    const advNome = profiles.find(p => p.id === processo.advogado_responsavel_id)?.nome ?? ''
    const filled = preencherTemplate(modelo.conteudo, processo, advNome)
    setConteudo(filled)
    setErro('')
    setStep('edit')
  }

  async function handleSalvar() {
    if (!titulo.trim()) { setErro('Informe o título do documento'); return }
    if (!conteudo.trim()) { setErro('Conteúdo não pode estar vazio'); return }
    setErro('')
    setLoading(true)
    const err = await onSalvar({
      modelo_id:   modeloId || null,
      processo_id: processoId,
      titulo,
      conteudo,
    })
    setLoading(false)
    if (err) setErro(err)
  }

  async function copiar() {
    await navigator.clipboard.writeText(conteudo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] shrink-0">
          <div className="flex items-center gap-3">
            <Wand2 size={16} className="text-[#1D5F60]" />
            <h2 className="text-[15px] font-semibold text-[#0f1923]">Gerar Documento</h2>
            {step === 'edit' && (
              <div className="flex items-center gap-1 text-[12px] text-[#9ca3af]">
                <ChevronRight size={12} />
                <span>Editar e salvar</span>
              </div>
            )}
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {step === 'select' ? (
            <>
              {/* Seleção de modelo */}
              <div>
                <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">
                  Modelo de documento <span className="text-red-500 normal-case font-normal">*</span>
                </label>
                <select value={modeloId} onChange={e => setModeloId(e.target.value)} className={inputCls}>
                  <option value="">Selecione o modelo…</option>
                  {modelos.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                {modelo && (
                  <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                    {modelo.tipo_documento.replace(/_/g, ' ')} {modelo.area_direito ? `· ${modelo.area_direito}` : ''}
                  </p>
                )}
              </div>

              {/* Seleção de processo */}
              <div>
                <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">
                  Processo <span className="text-red-500 normal-case font-normal">*</span>
                </label>
                <select value={processoId} onChange={e => setProcessoId(e.target.value)} className={inputCls}>
                  <option value="">Selecione o processo…</option>
                  {processos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.numero_processo ? `${p.numero_processo} — ` : ''}{p.titulo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview dos dados */}
              {processo && (
                <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6]">
                  <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Dados que serão preenchidos</p>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                    {[
                      ['Cliente',    processo.cliente?.nome              ?? '—'],
                      ['Tribunal',   processo.tribunal                   ?? '—'],
                      ['Vara',       processo.vara                       ?? '—'],
                      ['Valor',      processo.valor_causa ? formatCurrency(processo.valor_causa) : '—'],
                      ['Parte contrária', processo.partes_processo.filter(p => ['reu','outro','terceiro'].includes(p.tipo_parte)).map(p => p.pessoa_nome).join(', ') || '—'],
                      ['Advogado',   profiles.find(p => p.id === processo.advogado_responsavel_id)?.nome ?? '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-1.5">
                        <span className="text-[11px] text-[#9ca3af] shrink-0">{k}:</span>
                        <span className="text-[11px] text-[#374151] truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onFechar}
                  className="flex-1 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={gerarConteudo}
                  disabled={!modeloId || !processoId}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-[#1D5F60] hover:bg-[#27777A] text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  <Wand2 size={14} />
                  Preencher automaticamente
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Título */}
              <div>
                <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">Título do documento</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                    Conteúdo (editável)
                  </label>
                  <button
                    type="button"
                    onClick={copiar}
                    className="flex items-center gap-1 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
                  >
                    {copiado ? <><Check size={11} className="text-green-500" /> Copiado</> : <><Copy size={11} /> Copiar</>}
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={conteudo}
                  onChange={e => setConteudo(e.target.value)}
                  rows={20}
                  className={cn(inputCls, 'resize-none font-mono text-[12px] leading-relaxed')}
                />
              </div>

              {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep('select'); setErro('') }}
                  className="px-4 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
                  ← Voltar
                </button>
                <button type="button" onClick={copiar}
                  className="px-4 py-2.5 text-[13px] font-medium text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors flex items-center gap-1.5">
                  <Copy size={13} /> Copiar texto
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-[#1D5F60] hover:bg-[#27777A] text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  {loading ? 'Salvando…' : 'Salvar documento'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
