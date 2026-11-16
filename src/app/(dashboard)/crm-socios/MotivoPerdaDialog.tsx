'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, INPUT_CLASSE, ROTULO_CLASSE } from './visual'

interface Props {
  nome: string
  salvando: boolean
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
}

/** Pergunta o motivo antes de mover uma oportunidade para "Perdido" (o motivo é obrigatório). */
export default function MotivoPerdaDialog({ nome, salvando, onConfirmar, onCancelar }: Props) {
  const [motivo, setMotivo] = useState('')
  const vazio = motivo.trim() === ''

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="motivo-perda-titulo">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="motivo-perda-titulo" className="text-[15px] font-semibold text-[var(--color-ink)]">Marcar como perdida</h3>
            <p className="text-[12px] text-[var(--color-ink-3)] mt-0.5">{nome}</p>
          </div>
          <button type="button" onClick={onCancelar} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400" aria-label="Cancelar">
            <X size={16} />
          </button>
        </div>
        <div>
          <label htmlFor="motivo-perda" className={ROTULO_CLASSE}>Motivo da perda</label>
          <textarea
            id="motivo-perda"
            autoFocus
            rows={3}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex.: fechou com outro escritório, sem orçamento, parou de responder…"
            className={INPUT_CLASSE}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className={BOTAO_SECUNDARIO} disabled={salvando}>Cancelar</button>
          <button type="button" onClick={() => onConfirmar(motivo.trim())} className={BOTAO_PRIMARIO} disabled={vazio || salvando}>
            {salvando ? 'Salvando…' : 'Marcar como perdida'}
          </button>
        </div>
      </div>
    </div>
  )
}
