'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export default function RelatorioSinteticoForm({ pessoas }: { pessoas: { id: string; nome: string; processos: number }[] }) {
  const [pessoaId, setPessoaId] = useState(pessoas[0]?.id ?? '')

  if (pessoas.length === 0) {
    return <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-ink-3)]">Nenhuma pessoa com processos ligados ainda.</p>
  }
  const escolhida = pessoas.find(p => p.id === pessoaId)

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <div>
        <label htmlFor="pessoa" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-3)] mb-1.5">Em nome de</label>
        <select id="pessoa" value={pessoaId} onChange={e => setPessoaId(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[14px] text-[var(--color-ink)]">
          {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.processos} {p.processos === 1 ? 'processo' : 'processos'}</option>)}
        </select>
      </div>
      <a href={`/api/relatorios/sintetico?pessoa_id=${encodeURIComponent(pessoaId)}`} download
        className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] rounded-xl">
        <Download size={14} /> Gerar PDF{escolhida ? ` de ${escolhida.nome}` : ''}
      </a>
      <p className="text-[12px] text-[var(--color-ink-3)]">Relatórios grandes levam alguns segundos para gerar.</p>
    </div>
  )
}
