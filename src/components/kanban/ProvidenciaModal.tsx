'use client'

import { useState, useEffect } from 'react'
import {
  X, Loader2, CheckCircle2, AlertTriangle, Calendar,
  KanbanSquare, Clock, User, ArrowRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnalisePublicacao } from '@/lib/ai/prompts'
import type { KanbanPrioridade, KanbanStatus } from '@/types/kanban'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urgToPrioridade(urg?: string): KanbanPrioridade {
  if (urg === 'critica') return 'urgente'
  if (urg === 'alta')    return 'alta'
  if (urg === 'media')   return 'media'
  return 'baixa'
}

function sugerirTitulo(
  analise?: AnalisePublicacao | null,
  textoPublicacao?: string | null,
  numeroProcesso?: string | null,
): string {
  if (analise?.sugestao_acao) return analise.sugestao_acao
  if (numeroProcesso) return `Providenciar publicação — ${numeroProcesso}`
  const trecho = textoPublicacao?.slice(0, 60)?.trim()
  return trecho ? `Providenciar: ${trecho}…` : 'Providenciar publicação'
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Profile { id: string; nome: string }

interface Props {
  // Contexto da publicação
  publicacaoId:      string
  publicacaoTexto?:  string | null
  analise?:          AnalisePublicacao | null
  processoId?:       string | null
  processoNumero?:   string | null
  processoTitulo?:   string | null
  prazoData?:        string | null   // se vem da publicação (sem IA)
  prazoDetectado?:   boolean
  currentUserId?:    string
  onClose:           () => void
  onDone?:           () => void
}

const URGENCIA_CFG = {
  critica: { label: 'Crítica', bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 ring-1 ring-red-200'       },
  alta:    { label: 'Alta',    bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' },
  media:   { label: 'Média',  bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'    },
  baixa:   { label: 'Baixa',  bar: 'bg-emerald-500',badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
} as const

const PRI_OPTS: { v: KanbanPrioridade; l: string; dot: string }[] = [
  { v: 'baixa',   l: 'Baixa',   dot: 'bg-slate-300'  },
  { v: 'media',   l: 'Média',   dot: 'bg-blue-400'   },
  { v: 'alta',    l: 'Alta',    dot: 'bg-orange-400' },
  { v: 'urgente', l: 'Urgente', dot: 'bg-red-500'    },
]

const inputCls = 'w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#145A5B] text-[#374151] placeholder:text-[#c5cdd8] transition-all'

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ProvidenciaModal({
  publicacaoId, publicacaoTexto, analise,
  processoId, processoNumero, processoTitulo,
  prazoData: prazoDataProp, prazoDetectado: prazoDetectadoProp,
  currentUserId, onClose, onDone,
}: Props) {

  // Defaults inteligentes a partir do contexto
  const prazoDetectado = analise?.prazo_detectado ?? prazoDetectadoProp ?? false
  const prazoDataInit  = analise?.prazo_data ?? prazoDataProp ?? ''
  const urgencia       = analise?.urgencia
  const urgCfg         = urgencia ? URGENCIA_CFG[urgencia] : null

  // Estado do formulário
  const [titulo,       setTitulo]       = useState(() => sugerirTitulo(analise, publicacaoTexto, processoNumero))
  const [descricao,    setDescricao]    = useState(() => {
    if (!analise) return ''
    const partes = [analise.resumo, analise.observacoes].filter(Boolean)
    return partes.join('\n\n')
  })
  const [responsavelId, setResponsavelId] = useState(currentUserId ?? '')
  const [prioridade,    setPrioridade]    = useState<KanbanPrioridade>(() => urgToPrioridade(urgencia))
  const [prazoData,     setPrazoData]     = useState(prazoDataInit)
  const [criarPrazo,    setCriarPrazo]    = useState(prazoDetectado)

  // Profiles
  const [profiles, setProfiles] = useState<Profile[]>([])
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('profiles')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome')
        .then(({ data }) => { if (data) setProfiles(data) })
    })
  }, [])

  // Verificar duplicata ao abrir
  const [duplicata, setDuplicate] = useState<string | null>(null)
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('kanban_tasks')
        .select('id, titulo')
        .eq('publicacao_id', publicacaoId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setDuplicate(`Já existe um card para esta publicação: "${data.titulo}"`)
        })
    })
  }, [publicacaoId])

  // Estado de envio
  const [saving,  setSaving]  = useState(false)
  const [result,  setResult]  = useState<{ kanban: boolean; prazo: boolean } | null>(null)
  const [erro,    setErro]    = useState('')

  async function confirmar() {
    if (!titulo.trim()) { setErro('Título obrigatório'); return }
    setSaving(true)
    setErro('')

    try {
      const res = await fetch('/api/providencia', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicacao_id:    publicacaoId,
          titulo:           titulo.trim(),
          descricao:        descricao.trim() || null,
          responsavel_id:   responsavelId || null,
          processo_id:      processoId    || null,
          numero_processo:  processoNumero || null,
          prioridade,
          status_kanban:    'a_fazer',
          criar_prazo:      criarPrazo && !!prazoData,
          prazo_data:       prazoData || null,
          urgencia,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setErro(err.error ?? 'Erro ao criar providência')
        return
      }
      const data = await res.json()
      setResult({ kanban: !!data.kanban_task, prazo: !!data.agenda_item })
      onDone?.()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Tela de sucesso ────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Faixa verde de sucesso */}
          <div className="bg-[#0F3D3E] px-6 py-5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={24} className="text-white" />
            </div>
            <p className="text-white font-bold text-[16px]">Providência gerada!</p>
            <p className="text-white/60 text-[12px] mt-1">A publicação virou trabalho organizado</p>
          </div>

          <div className="p-6 space-y-3">
            {result.kanban && (
              <div className="flex items-center gap-3 bg-[#f0f9f9] rounded-xl px-4 py-3">
                <KanbanSquare size={16} className="text-[#145A5B] shrink-0" />
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-[#145A5B]">Card criado no Kanban</p>
                  <p className="text-[11px] text-[#7a8899]">Coluna "A Fazer" · responsável definido</p>
                </div>
                <CheckCircle2 size={14} className="text-emerald-500 ml-auto shrink-0" />
              </div>
            )}
            {result.prazo && (
              <div className="flex items-center gap-3 bg-amber-50 rounded-xl px-4 py-3">
                <Calendar size={16} className="text-amber-600 shrink-0" />
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-amber-700">Prazo na agenda</p>
                  <p className="text-[11px] text-[#7a8899]">{prazoData ? fmtDate(prazoData) : 'Adicionado'}</p>
                </div>
                <CheckCircle2 size={14} className="text-emerald-500 ml-auto shrink-0" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#e5e7eb] text-[13px] text-[#7a8899] hover:bg-[#f9fafb]">
                Fechar
              </button>
              <a href="/kanban" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0F3D3E] text-white text-[13px] font-semibold hover:bg-[#145A5B] transition-colors">
                Ver no Kanban <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Modal principal ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#f3f4f6]">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#145A5B]" />
            <h2 className="text-[15px] font-bold text-[#0f1923]">Gerar Providência</h2>
          </div>
          <div className="flex items-center gap-2">
            {urgCfg && (
              <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full', urgCfg.badge)}>
                Urgência {urgCfg.label}
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#f3f4f6] text-[#9ca3af]">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Aviso de duplicata ─────────────────────────────────────────── */}
          {duplicata && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-800 leading-relaxed">{duplicata}</p>
            </div>
          )}

          {/* ── Contexto da IA ─────────────────────────────────────────────── */}
          {analise && (
            <div className="bg-[#f9fafb] rounded-xl border border-[#f0f0f0] p-4 space-y-2.5">
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Análise IA</p>
              <p className="text-[12px] text-[#374151] leading-relaxed line-clamp-3">{analise.resumo}</p>
              <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2.5 border border-[#e5e7eb]">
                <ArrowRight size={12} className="text-[#145A5B] shrink-0 mt-0.5" />
                <p className="text-[12px] font-semibold text-[#145A5B] leading-snug">{analise.sugestao_acao}</p>
              </div>
            </div>
          )}

          {/* ── O que será criado ──────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-[#7a8899] uppercase tracking-wider mb-2.5">O que será criado</p>
            <div className="grid grid-cols-2 gap-2">
              {/* Kanban — sempre criado */}
              <div className="flex items-center gap-2.5 bg-[#E8F0F0] rounded-xl px-3.5 py-3">
                <KanbanSquare size={15} className="text-[#145A5B] shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-[#145A5B]">Card no Kanban</p>
                  <p className="text-[10px] text-[#7a8899]">Coluna A Fazer</p>
                </div>
                <CheckCircle2 size={13} className="text-[#145A5B] ml-auto shrink-0" />
              </div>

              {/* Prazo — toggle */}
              <button
                type="button"
                onClick={() => setCriarPrazo(v => !v)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left transition-colors border',
                  criarPrazo
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-[#f9fafb] border-[#e5e7eb] opacity-60',
                )}
              >
                <Calendar size={15} className={criarPrazo ? 'text-amber-600 shrink-0' : 'text-[#9ca3af] shrink-0'} />
                <div>
                  <p className={cn('text-[12px] font-semibold', criarPrazo ? 'text-amber-700' : 'text-[#7a8899]')}>
                    Prazo na agenda
                  </p>
                  <p className="text-[10px] text-[#9ca3af]">
                    {prazoData ? fmtDate(prazoData) : 'Data necessária'}
                  </p>
                </div>
                <div className={cn('w-4 h-4 rounded-full border-2 ml-auto shrink-0 flex items-center justify-center', criarPrazo ? 'bg-amber-500 border-amber-500' : 'border-[#d1d5db]')}>
                  {criarPrazo && <CheckCircle2 size={10} className="text-white" />}
                </div>
              </button>
            </div>
          </div>

          {/* ── Formulário ─────────────────────────────────────────────────── */}
          <div className="space-y-3">

            {/* Título */}
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Título da tarefa *</label>
              <input
                value={titulo}
                onChange={e => { setTitulo(e.target.value); setErro('') }}
                placeholder="O que precisa ser feito?"
                className={inputCls}
              />
            </div>

            {/* Responsável + Prioridade */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">
                  <User size={9} className="inline mr-1" /> Responsável
                </label>
                <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)} className={inputCls}>
                  <option value="">— Sem responsável —</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Prioridade</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRI_OPTS.map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPrioridade(o.v)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors',
                        prioridade === o.v
                          ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                          : 'bg-white text-[#7a8899] border-[#e5e7eb] hover:border-[#145A5B]',
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', o.dot)} />
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prazo (se toggle ativo ou há data) */}
            {(criarPrazo || prazoData) && (
              <div>
                <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">
                  <Clock size={9} className="inline mr-1" /> Prazo
                </label>
                <input
                  type="date"
                  value={prazoData}
                  onChange={e => setPrazoData(e.target.value)}
                  className={inputCls}
                />
                {criarPrazo && !prazoData && (
                  <p className="text-[11px] text-amber-600 mt-1">Preencha a data para criar o prazo na agenda</p>
                )}
              </div>
            )}

            {/* Processo */}
            {(processoTitulo || processoNumero) && (
              <div className="flex items-center gap-2 bg-[#f9fafb] rounded-xl px-3 py-2.5 border border-[#e5e7eb]">
                <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">Processo</span>
                <span className="text-[12px] text-[#374151] truncate">
                  {processoTitulo ?? processoNumero}
                </span>
              </div>
            )}

            {/* Fundamento legal (se IA detectou prazo) */}
            {analise?.fundamentacao && (
              <div className="flex items-start gap-2 bg-[#f9fafb] rounded-xl px-3 py-2.5 border border-[#e5e7eb]">
                <span className="text-[10px] font-mono text-[#9ca3af] leading-relaxed">{analise.fundamentacao}</span>
              </div>
            )}

            {erro && (
              <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
            )}
          </div>

          {/* ── Ações ──────────────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#e5e7eb] text-[13px] text-[#7a8899] hover:bg-[#f9fafb] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={saving || !titulo.trim()}
              className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold transition-colors disabled:opacity-40"
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Criando…</>
                : <><Sparkles size={14} /> Confirmar e criar</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
