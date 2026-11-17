'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { STATUS_LABELS } from '@/types/kanban'
import type { CartaoDoProcesso, MovimentacaoRecente } from '@/lib/kanban/pesquisa'

interface ProcessoAchado {
  id: string
  numero: string | null
  titulo: string | null
  cliente: string | null
  status: string | null
  fase: string | null
  ultimaMovimentacao: MovimentacaoRecente | null
  diasSemMovimento: number | null
  prazosPendentes: number
  proximoPrazo: string | null
  cartoes: CartaoDoProcesso[]
}
interface Resposta { processos: ProcessoAchado[]; soKanban: CartaoDoProcesso[] }

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const rotuloStatus = (s: string) => (STATUS_LABELS as Record<string, string>)[s] ?? s

function textoParado(dias: number | null) {
  if (dias === null) return null
  if (dias === 0) return 'movimentou hoje'
  if (dias === 1) return 'parado há 1 dia'
  return `parado há ${dias} dias`
}
const corParado = (dias: number | null) => (dias === null ? 'text-[var(--color-ink-3)]' : dias > 90 ? 'text-red-700 bg-red-50' : dias > 30 ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50')

function Cartao({ c }: { c: CartaoDoProcesso }) {
  const concluido = c.status === 'concluido'
  return (
    <li className="flex items-start gap-2 text-[12px]">
      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${concluido ? 'bg-emerald-50 text-emerald-700' : c.status === 'com_pendencia' ? 'bg-orange-50 text-orange-700' : c.status === 'fazendo' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
        {rotuloStatus(c.status)}
      </span>
      <span className="text-[var(--color-ink-2)]">
        {c.titulo}
        <span className="text-[var(--color-ink-3)]">
          {c.responsavel ? ` · ${c.responsavel}` : ' · sem responsável'}
          {c.prazo ? ` · entrega ${dataBR(c.prazo)}` : ''}
          {concluido && c.concluidoEm ? ` · concluído em ${dataBR(c.concluidoEm)}` : ''}
          {c.arquivado ? ' · arquivado' : ''}
        </span>
      </span>
    </li>
  )
}

/** Resultado da busca do Kanban "em tudo": o processo no sistema (última movimentação, prazos) e o que há dele no Kanban. */
export default function PesquisaProcessos({ busca }: { busca: string }) {
  const q = busca.trim()
  const [dados, setDados] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (q.length < 3) { setDados(null); setCarregando(false); setErro(false); return }
    let cancelado = false
    setCarregando(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kanban-pesquisa?q=${encodeURIComponent(q)}`)
        if (cancelado) return
        if (!res.ok) { setErro(true); setDados(null) } else { setErro(false); setDados(await res.json()) }
      } catch { if (!cancelado) { setErro(true); setDados(null) } }
      finally { if (!cancelado) setCarregando(false) }
    }, 400)
    return () => { cancelado = true; clearTimeout(t) }
  }, [q])

  if (q.length < 3) return null
  const vazio = dados && dados.processos.length === 0 && dados.soKanban.length === 0

  return (
    <section aria-label="Resultado da pesquisa no sistema" className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-copper)]">No sistema</h3>
        {carregando && <Loader2 size={13} className="animate-spin text-[var(--color-ink-3)]" />}
      </div>
      {erro && <p className="text-[12px] text-[var(--color-ink-3)]">Não foi possível pesquisar nos processos agora.</p>}
      {vazio && !carregando && <p className="text-[12px] text-[var(--color-ink-3)]">Nenhum processo nem cartão encontrado para “{q}”.</p>}

      <div className="space-y-3">
        {dados?.processos.map(p => {
          const parado = textoParado(p.diasSemMovimento)
          return (
            <article key={p.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link href={`/processos/${p.id}`} className="font-mono text-[13px] font-semibold text-[var(--color-ink)] hover:underline">{p.numero ?? 'Sem número'}</Link>
                  <p className="text-[12px] text-[var(--color-ink-2)] truncate">{[p.titulo, p.cliente].filter(Boolean).join(' · ')}</p>
                </div>
                {p.status && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{p.status}</span>}
              </div>

              <p className="mt-2 text-[12px] text-[var(--color-ink-2)] flex items-center gap-2 flex-wrap">
                {p.ultimaMovimentacao ? (
                  <>
                    <span>Última movimentação: <strong>{dataBR(p.ultimaMovimentacao.data)}</strong>{p.ultimaMovimentacao.titulo ? ` (${p.ultimaMovimentacao.fonte === 'publicacao' ? 'publicação' : 'andamento'}: ${p.ultimaMovimentacao.titulo.slice(0, 80)})` : ''}</span>
                    {parado && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${corParado(p.diasSemMovimento)}`}>{parado}</span>}
                  </>
                ) : (
                  <span className="text-[var(--color-ink-3)]">Nenhuma movimentação registrada no sistema.</span>
                )}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
                {p.prazosPendentes > 0 ? `${p.prazosPendentes} prazo${p.prazosPendentes > 1 ? 's' : ''} pendente${p.prazosPendentes > 1 ? 's' : ''}${p.proximoPrazo ? ` · próximo em ${dataBR(p.proximoPrazo)}` : ''}` : 'Sem prazos pendentes'}
              </p>

              <div className="mt-2 border-t border-[var(--color-border)] pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)] mb-1">No Kanban</p>
                {p.cartoes.length === 0
                  ? <p className="text-[12px] text-[var(--color-ink-3)]">Nenhum cartão no Kanban para este processo.</p>
                  : <ul className="space-y-1">{p.cartoes.map(c => <Cartao key={c.id} c={c} />)}</ul>}
              </div>
            </article>
          )
        })}

        {dados && dados.soKanban.length > 0 && (
          <article className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)] mb-1">Só no Kanban (sem processo cadastrado)</p>
            <ul className="space-y-1">{dados.soKanban.map(c => <Cartao key={c.id} c={c} />)}</ul>
          </article>
        )}
      </div>
    </section>
  )
}
