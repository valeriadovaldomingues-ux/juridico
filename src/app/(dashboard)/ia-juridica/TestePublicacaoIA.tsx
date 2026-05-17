'use client'

import { useState } from 'react'
import {
  Sparkles, Loader2, AlertTriangle, CalendarDays,
  CheckCircle2, ListTodo, Scale, Info, BookOpen, PenLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnalisePublicacao } from '@/lib/ai/prompts'

// ─── Config de urgência (espelho de PublicacaoIA) ─────────────────────────────

const urgenciaCfg: Record<string, { label: string; badge: string; bar: string; icon: React.ReactNode }> = {
  critica: {
    label: 'Crítica',
    badge: 'bg-red-100 text-red-700 ring-1 ring-red-200',
    bar:   'bg-red-500',
    icon:  <AlertTriangle size={13} className="text-red-600" />,
  },
  alta: {
    label: 'Alta',
    badge: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
    bar:   'bg-orange-500',
    icon:  <AlertTriangle size={13} className="text-orange-500" />,
  },
  media: {
    label: 'Média',
    badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    bar:   'bg-amber-400',
    icon:  <AlertTriangle size={13} className="text-amber-500" />,
  },
  baixa: {
    label: 'Baixa',
    badge: 'bg-green-100 text-green-700 ring-1 ring-green-200',
    bar:   'bg-green-500',
    icon:  <CheckCircle2 size={13} className="text-green-600" />,
  },
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TestePublicacaoIA() {
  const [texto,   setTexto]   = useState('')
  const [analise, setAnalise] = useState<AnalisePublicacao | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState('')

  async function analisar() {
    const t = texto.trim()
    if (!t) { setErro('Cole o texto da publicação antes de analisar.'); return }

    setErro('')
    setAnalise(null)
    setLoading(true)

    try {
      const res = await fetch('/api/ia/publicacao', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ textoPublicacao: t }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setErro(err.error ?? 'Erro na análise')
        return
      }
      setAnalise(await res.json())
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const urgCfg = analise ? (urgenciaCfg[analise.urgencia] ?? urgenciaCfg.media) : null

  return (
    <div className="space-y-4">

      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-2">
        <PenLine size={15} className="text-amber-600" />
        <h2 className="text-[15px] font-semibold text-[#0f1923]">Teste de Publicação</h2>
        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Teste interno
        </span>
      </div>
      <p className="text-[12px] text-[#7a8899] -mt-1">
        Cole qualquer texto de publicação para testar a análise. Resultado não é salvo no banco.
      </p>

      {/* Card de entrada */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 space-y-4">
        <textarea
          value={texto}
          onChange={e => { setTexto(e.target.value); setErro('') }}
          rows={8}
          placeholder={
            'Cole aqui o texto da publicação do DJe…\n\n' +
            'Exemplo:\n' +
            'Intimação — Processo nº 1234567-89.2024.8.26.0100\n' +
            'Intime-se o(a) advogado(a) da parte autora para, no prazo de 15 (quinze) dias úteis, ' +
            'manifestar-se sobre a contestação apresentada.'
          }
          className="w-full px-4 py-3 text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-amber-400 text-[#374151] placeholder:text-[#c5cdd8] resize-none leading-relaxed transition-all font-mono"
        />

        {texto.trim().length > 0 && (
          <p className="text-[11px] text-[#9ca3af] -mt-2">{texto.trim().length} caracteres</p>
        )}

        {erro && (
          <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
        )}

        <button
          onClick={analisar}
          disabled={loading || !texto.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {loading ? 'Analisando…' : 'Analisar publicação'}
        </button>
      </div>

      {/* Resultado — mesma estrutura da análise oficial */}
      {analise && urgCfg && (
        <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden">

          {/* Cabeçalho do resultado */}
          <div className="px-6 py-4 border-b border-[#f3f4f6] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[#1a1d23]">Análise da Publicação</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <PenLine size={9} /> Teste — não salvo
              </span>
            </div>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0', urgCfg.badge)}>
              {urgCfg.icon} Urgência {urgCfg.label}
            </span>
          </div>

          <div className="divide-y divide-[#f9fafb]">

            {/* Bloco 1 — Resumo */}
            <div className="px-6 py-4">
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen size={10} /> Resumo
              </p>
              <p className="text-[13px] text-[#374151] leading-relaxed">{analise.resumo}</p>
            </div>

            {/* Bloco 2 — Prazo */}
            <div className="px-6 py-4">
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CalendarDays size={10} /> Prazo
              </p>
              {analise.prazo_detectado ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <CalendarDays size={15} className="text-amber-500" />
                    </div>
                    <div>
                      {analise.tipo_prazo && (
                        <p className="text-[12px] font-semibold text-[#1D5F60] mb-0.5">{analise.tipo_prazo}</p>
                      )}
                      {analise.prazo_data && (
                        <p className="text-[14px] font-bold text-[#1a1d23]">
                          {new Date(analise.prazo_data + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                          })}
                        </p>
                      )}
                      {analise.prazo_descricao && (
                        <p className="text-[12px] text-[#6b7280] mt-0.5 leading-relaxed">{analise.prazo_descricao}</p>
                      )}
                    </div>
                  </div>
                  {analise.fundamentacao && (
                    <div className="flex items-center gap-2 bg-[#f9fafb] rounded-lg px-3 py-2">
                      <Scale size={11} className="text-[#9ca3af] shrink-0" />
                      <p className="text-[11px] text-[#6b7280] font-mono leading-relaxed">{analise.fundamentacao}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <CheckCircle2 size={14} className="text-[#d1d5db]" />
                  <p className="text-[13px] italic">Nenhum prazo identificado nesta publicação</p>
                </div>
              )}
            </div>

            {/* Bloco 3 — Providência sugerida */}
            <div className="px-6 py-4">
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ListTodo size={10} /> Providência Sugerida
              </p>
              <p className="text-[13px] text-[#374151] leading-relaxed font-medium">{analise.sugestao_acao}</p>
            </div>

            {/* Bloco 4 — Observações (condicional) */}
            {analise.observacoes && (
              <div className="px-6 py-4 bg-amber-50/50">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Info size={10} /> Observações
                </p>
                <p className="text-[12px] text-amber-900 leading-relaxed">{analise.observacoes}</p>
              </div>
            )}

            {/* Bloco 5 — Urgência visual */}
            <div className="px-6 py-3 bg-[#f9fafb] flex items-center gap-3">
              <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">
                Nível de urgência
              </span>
              <div className="flex-1 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', urgCfg.bar)}
                  style={{
                    width: analise.urgencia === 'critica' ? '100%'
                         : analise.urgencia === 'alta'    ? '75%'
                         : analise.urgencia === 'media'   ? '50%'
                         :                                  '25%',
                  }}
                />
              </div>
              <span className={cn('text-[11px] font-bold px-2.5 py-0.5 rounded-full', urgCfg.badge)}>
                {urgCfg.label}
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
