'use client'

import { useMemo, useState } from 'react'
import { Loader2, MessageSquarePlus, Send, Sparkles } from 'lucide-react'
import AuroraClienteHistoricoList from '@/components/aurora-cliente/AuroraClienteHistoricoList'
import type { AuroraClienteConversa } from '@/lib/aurora-cliente'
import { AURORA_CLIENTE_FALLBACK } from '@/lib/aurora-cliente'

export default function AuroraClientePanel({
  processoId,
  historicoInicial = [],
}: {
  processoId: string
  historicoInicial?: AuroraClienteConversa[]
}) {
  const [pergunta, setPergunta] = useState('')
  const [precisaRetornoHumano, setPrecisaRetornoHumano] = useState(false)
  const [historico, setHistorico] = useState<AuroraClienteConversa[]>(historicoInicial)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const ultimaResposta = useMemo(() => historico[0] ?? null, [historico])

  async function enviarPergunta() {
    const perguntaTrim = pergunta.trim()
    if (!perguntaTrim) {
      setErro('Digite uma pergunta.')
      return
    }

    setErro('')
    setLoading(true)

    try {
      const response = await fetch(`/api/portal/processos/${processoId}/aurora-cliente/perguntar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pergunta: perguntaTrim,
          precisaRetornoHumano,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Não foi possível processar a pergunta.')
      }

      if (payload?.conversation) {
        setHistorico(prev => [payload.conversation as AuroraClienteConversa, ...prev])
      } else {
        const historicoResponse = await fetch(`/api/portal/processos/${processoId}/aurora-cliente/historico`)
        if (historicoResponse.ok) {
          const atualizado = await historicoResponse.json().catch(() => [])
          setHistorico(Array.isArray(atualizado) ? atualizado as AuroraClienteConversa[] : [])
        }
      }

      setPergunta('')
      setPrecisaRetornoHumano(false)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a pergunta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F4EE] text-[#C49557]">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">Aurora Cliente</p>
            <h3 className="mt-1 text-[18px] font-semibold text-[#1C1C2E]">Pergunte sobre seu processo</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
              Respostas simples, com base apenas nos dados liberados do seu processo, relatórios, comunicações e documentos.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            value={pergunta}
            onChange={event => setPergunta(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-[#E8E3D8] bg-[#FCFBF8] px-4 py-3 text-[13px] leading-relaxed text-[#1C1C2E] outline-none transition-colors focus:border-[#C49557]"
            placeholder="Ex.: Qual foi a última atualização do meu processo?"
          />

          <label className="flex items-center gap-2 text-[12px] text-[#6B7280]">
            <input
              type="checkbox"
              checked={precisaRetornoHumano}
              onChange={event => setPrecisaRetornoHumano(event.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5DB] text-[#1D5F60] focus:ring-[#1D5F60]"
            />
            Preciso de retorno humano
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-[#9CA3AF]">
              Se a informação não estiver disponível, a Aurora Cliente encaminha sua solicitação para a equipe.
            </p>
            <button
              type="button"
              onClick={enviarPergunta}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1D5F60] px-4 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#174d4d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Perguntar
            </button>
          </div>

          {erro && (
            <p className="text-[12px] text-rose-600">{erro}</p>
          )}
        </div>
      </div>

      {ultimaResposta && (
        <div className="rounded-2xl border border-[#E8E3D8] bg-[#FCFBF8] p-4 text-[13px] leading-relaxed text-[#1C1C2E]">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#9CA3AF]">Última resposta</p>
          <p className="mt-2 whitespace-pre-wrap">
            {ultimaResposta.resposta || AURORA_CLIENTE_FALLBACK}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquarePlus size={14} className="text-[#C49557]" />
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">Histórico</p>
        </div>
        <AuroraClienteHistoricoList items={historico} />
      </div>
    </div>
  )
}
