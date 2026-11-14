'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Gavel, Loader2, X } from 'lucide-react'

interface Movimento { data: string | null; nome: string; complemento: string | null }
interface DoTribunal { tribunal: string | null; grau: string | null; classe: string | null; orgaoJulgador: string | null; ajuizamento: string | null; assuntos: string[]; sigilo: number | null; atualizadoEm: string | null; movimentos: Movimento[] }
interface Resposta { numero: string; pedv: { vara: string | null; comarca: string | null; classe: string | null; distribuicao: string | null }; tribunal: DoTribunal[]; fonte: string }

const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')

/** Botão "Conferir no tribunal": consulta o DataJud (CNJ) e mostra o que o tribunal informa ao lado do que o PEDV tem. Só leitura. */
export default function ConferirTribunal({ processoId }: { processoId: string }) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<Resposta | null>(null)

  async function consultar() {
    setAberto(true); setCarregando(true); setErro(''); setDados(null)
    try {
      const res = await fetch(`/api/processos/${processoId}/conferir-tribunal`)
      const json = await res.json()
      if (!res.ok) setErro(json.error ?? 'Não foi possível consultar o tribunal.')
      else setDados(json as Resposta)
    } catch { setErro('Não foi possível consultar o tribunal.') }
    setCarregando(false)
  }

  return (
    <>
      <button onClick={consultar} className="flex items-center gap-2 px-4 py-2.5 border border-[#e5e7eb] bg-white text-[#374151] text-sm font-medium rounded-xl hover:bg-[#f9fafb] transition-colors" title="Consultar o processo na base pública do CNJ (DataJud)">
        <Gavel size={14} /> Conferir no tribunal
      </button>
      {aberto && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(false)}>
          <div role="dialog" aria-modal="true" aria-label="Conferir no tribunal" onClick={e => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <p className="text-[16px] font-semibold text-[var(--color-ink)]">Conferir no tribunal {dados ? `· ${dados.numero}` : ''}</p>
              <button onClick={() => setAberto(false)} aria-label="Fechar" className="text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"><X size={16} /></button>
            </div>
            {carregando && <p className="flex items-center gap-2 text-[13px] text-[var(--color-ink-3)]"><Loader2 size={14} className="animate-spin" /> Consultando o CNJ… costuma levar de 30 a 40 segundos.</p>}
            {erro && <p className="text-[13px] text-red-700 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}
            {dados && dados.tribunal.length === 0 && <p className="text-[13px] text-[var(--color-ink-2)]">O DataJud não tem este processo (pode ser sigiloso, muito recente ou de um tribunal que ainda não envia os dados). Confira direto no site do tribunal.</p>}
            {dados?.tribunal.map((t, i) => (
              <div key={i} className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
                <p className="text-[13px] font-semibold text-[var(--color-ink)]">{t.tribunal} · {t.grau === 'G1' ? '1º grau' : t.grau === 'G2' ? '2º grau' : t.grau ?? ''}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
                  <p><span className="text-[var(--color-ink-3)]">Classe (tribunal):</span> {t.classe ?? '—'}</p>
                  <p><span className="text-[var(--color-ink-3)]">Classe (PEDV):</span> {dados.pedv.classe ?? '—'}</p>
                  <p><span className="text-[var(--color-ink-3)]">Órgão julgador (tribunal):</span> {t.orgaoJulgador ?? '—'}</p>
                  <p><span className="text-[var(--color-ink-3)]">Vara (PEDV):</span> {[dados.pedv.vara, dados.pedv.comarca].filter(Boolean).join(' — ') || '—'}</p>
                  <p><span className="text-[var(--color-ink-3)]">Ajuizamento (tribunal):</span> {br(t.ajuizamento)}</p>
                  <p><span className="text-[var(--color-ink-3)]">Distribuição (PEDV):</span> {br(dados.pedv.distribuicao)}{t.ajuizamento && dados.pedv.distribuicao && t.ajuizamento !== dados.pedv.distribuicao ? ' ⚠ difere' : ''}</p>
                  {t.assuntos.length > 0 && <p className="sm:col-span-2"><span className="text-[var(--color-ink-3)]">Assuntos:</span> {t.assuntos.join('; ')}</p>}
                  <p className="sm:col-span-2"><span className="text-[var(--color-ink-3)]">Atualizado pelo tribunal em:</span> {br(t.atualizadoEm)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-3)] mb-1.5">Últimas movimentações</p>
                  <ul className="space-y-1">
                    {t.movimentos.map((m, j) => <li key={j} className="text-[12px] text-[var(--color-ink-2)]"><span className="font-medium">{br(m.data)}</span> — {m.nome}{m.complemento ? ` (${m.complemento})` : ''}</li>)}
                    {t.movimentos.length === 0 && <li className="text-[12px] text-[var(--color-ink-3)]">Sem movimentações na base pública.</li>}
                  </ul>
                </div>
              </div>
            ))}
            {dados && <p className="text-[11px] text-[var(--color-ink-3)]">Fonte: {dados.fonte}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
