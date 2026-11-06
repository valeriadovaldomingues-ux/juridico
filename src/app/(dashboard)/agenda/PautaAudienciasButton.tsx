'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Segunda a sexta da semana que vem (a pauta costuma ser tirada na sexta ou no fim de semana); de segunda a sexta nos outros dias. */
function semanaPadrao(hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const dow = d.getDay()
  const segunda = new Date(d)
  segunda.setDate(d.getDate() + (dow === 0 ? 1 : dow >= 5 ? 8 - dow : 1 - dow))
  const sexta = new Date(segunda)
  sexta.setDate(segunda.getDate() + 4)
  return { de: isoLocal(segunda), ate: isoLocal(sexta) }
}

// Pauta de audiências por período em PDF (só audiências e perícias).
export default function PautaAudienciasButton() {
  const [aberto, setAberto] = useState(false)
  const [{ de, ate }, setPeriodo] = useState(semanaPadrao)
  const invalido = !de || !ate || ate < de
  const inputCls = 'rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[var(--color-ink)]'

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--color-border)] hover:border-[var(--color-copper)] text-[13px] font-medium text-[var(--color-ink-2)] rounded-xl transition-colors"
      >
        <FileText size={14} /> Pauta (PDF)
      </button>
      {aberto && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl space-y-3">
          <p className="text-[12px] font-semibold text-[var(--color-ink)]">Pauta de audiências</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-[var(--color-ink-3)]">De
              <input type="date" className={`${inputCls} w-full mt-1`} value={de} onChange={e => setPeriodo(p => ({ ...p, de: e.target.value }))} />
            </label>
            <label className="text-[11px] text-[var(--color-ink-3)]">Até
              <input type="date" className={`${inputCls} w-full mt-1`} value={ate} onChange={e => setPeriodo(p => ({ ...p, ate: e.target.value }))} />
            </label>
          </div>
          {invalido && <p className="text-[11px] text-red-600">A data final precisa ser igual ou depois da inicial.</p>}
          <a
            href={invalido ? undefined : `/api/agenda/pauta-audiencias?de=${de}&ate=${ate}`}
            aria-disabled={invalido}
            onClick={() => !invalido && setAberto(false)}
            className={`block text-center rounded-lg bg-[var(--color-sidebar)] px-3 py-2 text-[12px] font-semibold text-white ${invalido ? 'opacity-40 pointer-events-none' : 'hover:bg-[var(--color-petrol)]'}`}
          >
            Gerar PDF
          </a>
          <p className="text-[11px] text-[var(--color-ink-3)]">Só audiências e perícias do período, com processo, cliente, parte contrária, vara, responsáveis, status e descrição.</p>
        </div>
      )}
    </div>
  )
}
