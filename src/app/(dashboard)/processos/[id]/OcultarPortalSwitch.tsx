'use client'

import { useState } from 'react'
import { EyeOff, Loader2 } from 'lucide-react'

/**
 * Interruptor "Ocultar do portal do cliente" da ficha do processo.
 * Por padrão todo processo aparece no portal; segredo de justiça nunca aparece. Só quem gerencia o portal vê isto.
 * Se a coluna ainda não existe no banco (migração pendente), o interruptor fica desligado com um aviso.
 */
export default function OcultarPortalSwitch({
  processoId, ocultar, colunaExiste, segredoJustica,
}: { processoId: string; ocultar: boolean; colunaExiste: boolean; segredoJustica: boolean }) {
  const [valor, setValor] = useState(ocultar)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function alternar() {
    const novo = !valor
    setOcupado(true)
    setErro('')
    try {
      const res = await fetch(`/api/processos/${processoId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocultar_portal: novo }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(dados.error ?? 'Não foi possível salvar.'); return }
      setValor(novo)
    } finally {
      setOcupado(false)
    }
  }

  const desligado = !colunaExiste || ocupado

  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#1a1d23] flex items-center gap-2"><EyeOff size={14} className="text-[#7a8899]" /> Ocultar do portal do cliente</p>
          <p className="text-[12px] text-[#7a8899] mt-1 leading-relaxed">
            {segredoJustica
              ? 'Segredo de justiça: este processo nunca aparece no portal do cliente.'
              : valor
                ? 'Este processo NÃO aparece para o cliente no portal.'
                : 'Este processo aparece para o cliente no portal (andamentos e audiências). Ligue para esconder.'}
          </p>
          {!colunaExiste && <p className="text-[12px] text-amber-700 mt-1">O portal ainda não foi ativado no banco de dados.</p>}
          {erro && <p role="alert" className="text-[12px] text-rose-700 mt-1">{erro}</p>}
        </div>
        <button
          type="button" role="switch" aria-checked={valor} aria-label="Ocultar do portal do cliente"
          onClick={alternar} disabled={desligado}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${valor ? 'bg-[#145A5B]' : 'bg-[#d1d5db]'}`}
        >
          {ocupado ? <Loader2 size={12} className="absolute left-1/2 -translate-x-1/2 animate-spin text-white" /> : (
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${valor ? 'translate-x-5' : 'translate-x-0.5'}`} />
          )}
        </button>
      </div>
    </div>
  )
}
