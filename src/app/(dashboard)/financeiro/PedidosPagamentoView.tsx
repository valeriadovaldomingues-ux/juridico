'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Loader2, Plus, X, XCircle } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { PedidoPagamento } from '@/lib/financeiro/pedidos-pagamento'
import { FORMAS_PAGAMENTO, FORMAS_COM_PARCELAS, rotuloPagamento, type FormaPagamento } from '@/lib/financeiro/forma-pagamento'

const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'
const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

const VAZIO = { descricao: '', fornecedor: '', categoria: 'Geral', centro_custo: '', valor: '', vencimento: '', observacoes: '', forma_pagamento: '' as FormaPagamento | '', parcelas_total: '', parcela_atual: '' }

const dataHoraBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/** Contas a pagar da Operação: cadastra → o sócio dá o OK → vira despesa na hora. */
export default function PedidosPagamentoView({ podeDecidir, onDespesaCriada }: { podeDecidir: boolean; onDespesaCriada: () => void }) {
  const [pedidos, setPedidos] = useState<PedidoPagamento[] | null>(null)
  const [erro, setErro] = useState('')
  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [decidindo, setDecidindo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const res = await fetch('/api/financeiro/pedidos-pagamento')
    const corpo = await res.json().catch(() => [])
    if (!res.ok) { setErro((corpo as { error?: string }).error ?? 'Não foi possível carregar.'); return }
    setPedidos(corpo as PedidoPagamento[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  const grupos = useMemo(() => ({
    aguardando: (pedidos ?? []).filter(p => p.status === 'aguardando_ok'),
    aprovados: (pedidos ?? []).filter(p => p.status === 'aprovado').sort((a, b) => (b.decidido_em ?? '').localeCompare(a.decidido_em ?? '')),
    recusados: (pedidos ?? []).filter(p => p.status === 'recusado'),
  }), [pedidos])

  async function criar() {
    setSalvando(true); setErro('')
    const res = await fetch('/api/financeiro/pedidos-pagamento', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    setSalvando(false)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro((corpo as { error?: string }).error ?? 'Não foi possível salvar.'); return }
    setNovo(false); setForm(VAZIO)
    await carregar()
  }

  async function decidir(p: PedidoPagamento, acao: 'aprovar' | 'recusar') {
    let motivo = ''
    if (acao === 'recusar') {
      const r = window.prompt('Motivo da recusa (opcional):', '')
      if (r === null) return
      motivo = r
    } else if (!window.confirm(`OK para pagar "${p.descricao}" — ${formatCurrency(Number(p.valor))} (vence em ${formatDate(p.vencimento)})?\n\nEla entra agora em Despesas.`)) return
    setDecidindo(p.id); setErro('')
    const res = await fetch(`/api/financeiro/pedidos-pagamento/${p.id}/decidir`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao, motivo }) })
    setDecidindo(null)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro((corpo as { error?: string }).error ?? 'Não foi possível registrar.'); await carregar(); return }
    await carregar()
    if (acao === 'aprovar') onDespesaCriada() // atualiza as abas de Despesas / A Pagar
  }

  const cartao = (p: PedidoPagamento) => (
    <li key={p.id} className="rounded-xl border border-[#E2DDD8] bg-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#1a1d23]">{p.descricao}</p>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {[p.fornecedor, p.categoria !== 'Geral' ? p.categoria : null, p.centro_custo, rotuloPagamento(p)].filter(Boolean).join(' · ') || 'Sem fornecedor informado'}
          </p>
          {p.observacoes && <p className="text-[12px] text-[#4b5563] mt-1 whitespace-pre-line">{p.observacoes}</p>}
          <p className="text-[11px] text-[#9ca3af] mt-1.5">
            Pedido por {p.solicitado_por_nome ?? '—'} em {dataHoraBR(p.solicitado_em)}
            {p.decidido_em && ` · ${p.status === 'aprovado' ? 'OK de' : 'Recusado por'} ${p.decidido_por_nome ?? '—'} em ${dataHoraBR(p.decidido_em)}`}
          </p>
          {p.status === 'recusado' && p.motivo_recusa && <p className="text-[12px] text-rose-700 mt-1">Motivo: {p.motivo_recusa}</p>}
          {p.status === 'aprovado' && <p className="text-[12px] text-emerald-700 mt-1">Já entrou em Despesas{p.forma_pagamento === 'credito' && (p.parcelas_total ?? 0) > 1 ? ' (todas as parcelas, mês a mês)' : ''}.</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[15px] font-semibold text-[#1a1d23]">{formatCurrency(Number(p.valor))}</p>
          <p className="text-[11px] text-[#6b7280]">vence em {formatDate(p.vencimento)}</p>
        </div>
      </div>
      {p.status === 'aguardando_ok' && podeDecidir && (
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={() => decidir(p, 'recusar')} disabled={decidindo === p.id} className="px-3 py-2 text-[12px] font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50">Recusar</button>
          <button onClick={() => decidir(p, 'aprovar')} disabled={decidindo === p.id} className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-[#1D5F60] rounded-lg hover:bg-[#27777A] disabled:opacity-50">
            {decidindo === p.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} OK, pode pagar
          </button>
        </div>
      )}
    </li>
  )

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1a1d23]">Pedidos a pagar</h3>
          <p className="text-[12px] text-[#6b7280] mt-0.5">A Operação cadastra a conta; quando o sócio dá o OK, ela entra em Despesas na mesma hora.</p>
        </div>
        <button onClick={() => { setForm(VAZIO); setNovo(true) }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#145A5B] text-white text-[12px] font-medium hover:bg-[#1B6E70]">
          <Plus size={13} /> Novo pedido
        </button>
      </div>

      {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
      {pedidos === null && !erro && <p className="flex items-center gap-2 text-[13px] text-[#6b7280]"><Loader2 size={14} className="animate-spin" /> Carregando…</p>}

      {pedidos !== null && (
        <>
          <section className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-amber-700"><Clock size={13} /> Aguardando OK ({grupos.aguardando.length})</h4>
            {grupos.aguardando.length === 0 ? <p className="text-[12px] text-[#9ca3af]">Nenhum pedido esperando OK.</p> : <ul className="space-y-2.5">{grupos.aguardando.map(cartao)}</ul>}
          </section>
          {grupos.aprovados.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-emerald-700"><CheckCircle2 size={13} /> Com OK — já em Despesas ({grupos.aprovados.length})</h4>
              <ul className="space-y-2.5">{grupos.aprovados.map(cartao)}</ul>
            </section>
          )}
          {grupos.recusados.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-rose-700"><XCircle size={13} /> Recusados ({grupos.recusados.length})</h4>
              <ul className="space-y-2.5">{grupos.recusados.map(cartao)}</ul>
            </section>
          )}
        </>
      )}

      {novo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
              <h2 className="text-[15px] font-semibold text-[#0f1923]">Novo pedido a pagar</h2>
              <button onClick={() => setNovo(false)} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className={labelCls}>O que vai ser pago *</label><input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inputCls} placeholder="Ex.: Aluguel da sala, Internet, Custas" autoFocus /></div>
              <div><label className={labelCls}>Fornecedor / quem recebe</label><input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Valor (R$) *</label><input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className={inputCls} placeholder="1.250,00" inputMode="decimal" /></div>
                <div><label className={labelCls}>Vencimento *</label><input type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Categoria</label><input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Centro de custo</label><input value={form.centro_custo} onChange={e => setForm(f => ({ ...f, centro_custo: e.target.value }))} className={inputCls} /></div>
              </div>
              <div className="space-y-3 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-3">
                <div>
                  <label className={labelCls}>Forma de pagamento</label>
                  <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value as FormaPagamento | '' }))} className={inputCls}>
                    <option value="">— Não informada —</option>
                    {FORMAS_PAGAMENTO.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                {form.forma_pagamento && FORMAS_COM_PARCELAS.includes(form.forma_pagamento) && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Total de parcelas</label><input type="number" min="1" max="60" value={form.parcelas_total} onChange={e => setForm(f => ({ ...f, parcelas_total: e.target.value }))} className={inputCls} placeholder="Ex: 10" /></div>
                      <div><label className={labelCls}>Parcela deste mês</label><input type="number" min="1" max="60" value={form.parcela_atual} onChange={e => setForm(f => ({ ...f, parcela_atual: e.target.value }))} className={inputCls} placeholder="Ex: 1" /></div>
                    </div>
                    <p className="text-[11px] text-[#6b7280]">O valor acima é o da <strong>parcela</strong>. No OK, as parcelas entram em Despesas mês a mês.</p>
                  </>
                )}
              </div>
              <div><label className={labelCls}>Observações (linha digitável, link do boleto…)</label><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} className={cn(inputCls, 'resize-none')} /></div>
              {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
              <div className="flex gap-3 justify-between">
                <button onClick={() => setNovo(false)} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Cancelar</button>
                <button onClick={criar} disabled={salvando || !form.descricao.trim() || !form.valor.trim() || !form.vencimento} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
                  {salvando && <Loader2 size={13} className="animate-spin" />} Enviar para o OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
