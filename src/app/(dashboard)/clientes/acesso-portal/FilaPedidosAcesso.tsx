'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Loader2, X, ShieldCheck, ShieldAlert, PhoneCall } from 'lucide-react'
import { formatCpf, formatCnpj } from '@/lib/cnpj'
import type { PedidoNaFila, CandidatoPedido } from '@/lib/portal-cliente/gestao'

const dataBR = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const docFormatado = (d: string) => (d.length === 14 ? formatCnpj(d) : formatCpf(d))

const ROTULO_NASC: Record<CandidatoPedido['nascimento'], { texto: string; cls: string }> = {
  confere: { texto: 'Nascimento confere', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  nao_confere: { texto: 'Nascimento NÃO confere', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  sem_dado: { texto: 'Sem nascimento no cadastro', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
}

function Pedido({ pedido }: { pedido: PedidoNaFila }) {
  const router = useRouter()
  const [clienteId, setClienteId] = useState(pedido.candidatos.length === 1 ? pedido.candidatos[0].id : '')
  const [email, setEmail] = useState(pedido.email)
  const [confirmado, setConfirmado] = useState(false)
  const [ocupado, setOcupado] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function decidir(acao: 'aprovar' | 'rejeitar') {
    if (acao === 'rejeitar' && !window.confirm('Rejeitar este pedido? Os dados de conferência serão apagados.')) return
    setOcupado(acao)
    setMsg(null)
    try {
      const res = await fetch(`/api/portal-admin/pedidos/${pedido.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, cliente_id: clienteId || undefined, email_acesso: email, confirmado_com_cliente: confirmado }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ tipo: 'erro', texto: dados.error ?? 'Não foi possível concluir.' }); return }
      setMsg({
        tipo: 'ok',
        texto: acao === 'rejeitar'
          ? 'Pedido rejeitado.'
          : dados.codigoEnviado
            ? 'Acesso liberado. O primeiro código foi enviado ao e-mail de acesso.'
            : 'Acesso liberado, mas o e-mail não saiu (envio não configurado). O cliente pode pedir o código na tela de entrada.',
      })
      router.refresh()
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="rounded-xl border border-[#E2DDD8] bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-[#a8b3c4] uppercase tracking-wider">Documento informado</p>
          <p className="text-[15px] font-semibold text-[#1a1d23] tabular-nums">{docFormatado(pedido.documento)}</p>
        </div>
        <p className="text-[11px] text-[#a8b3c4]">Pedido de {dataBR(pedido.criadoEm)}</p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        <div><dt className="text-[11px] text-[#a8b3c4]">E-mail pedido</dt><dd className="text-[#1a1d23] break-all">{pedido.email}</dd></div>
        <div><dt className="text-[11px] text-[#a8b3c4]">Telefone pedido</dt><dd className="text-[#1a1d23]">{pedido.telefone ?? '—'}</dd></div>
        <div><dt className="text-[11px] text-[#a8b3c4]">Nascimento informado</dt><dd className="text-[#1a1d23]">{dataBR(pedido.nascimentoInformado)}</dd></div>
        <div><dt className="text-[11px] text-[#a8b3c4]">Mãe / Pai informados</dt><dd className="text-[#1a1d23]">{pedido.nomeMae ?? '—'} / {pedido.nomePai ?? '—'}</dd></div>
      </dl>

      <div>
        <p className="text-[11px] text-[#a8b3c4] uppercase tracking-wider mb-2">Cliente(s) com este documento</p>
        {pedido.candidatos.length === 0 ? (
          <p className="text-[13px] text-rose-700 flex items-center gap-1.5"><ShieldAlert size={14} /> Nenhum cadastro com este CPF/CNPJ. Só dá para rejeitar, ou corrigir o cadastro e pedir novo acesso.</p>
        ) : (
          <div className="space-y-2">
            {pedido.candidatos.map(c => (
              <label key={c.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${clienteId === c.id ? 'border-[#1D5F60] bg-[#F3F8F8]' : 'border-[#E2DDD8]'}`}>
                <input type="radio" name={`cli-${pedido.id}`} className="mt-1" checked={clienteId === c.id} onChange={() => setClienteId(c.id)} />
                <div className="min-w-0 text-[13px]">
                  <Link href={`/clientes/${c.id}`} target="_blank" className="font-medium text-[#1D5F60] hover:underline">{c.nome}</Link>
                  <p className="text-[#7a8899] break-all">E-mail do cadastro: {c.email ?? '—'} · Tel.: {c.telefone ?? '—'}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${ROTULO_NASC[c.nascimento].cls}`}>{ROTULO_NASC[c.nascimento].texto}</span>
                    {c.liberado && <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 bg-sky-50 text-sky-700 ring-sky-200">Já liberado</span>}
                  </div>
                </div>
              </label>
            ))}
            {pedido.candidatos.length > 1 && <p className="text-[12px] text-amber-700">Há mais de um cadastro com este documento: escolha o correto (e depois resolva a duplicidade).</p>}
          </div>
        )}
      </div>

      {pedido.candidatos.length > 0 && (
        <div className="space-y-3 rounded-lg bg-[#FBF8F3] border border-[#EDE4D3] p-4">
          <p className="text-[13px] text-[#6b4a1f] flex items-start gap-2"><PhoneCall size={15} className="mt-0.5 shrink-0" /> Confirme com o cliente por telefone ou WhatsApp (use um número que o escritório já tem, não o do pedido) antes de aprovar.</p>
          <div>
            <label htmlFor={`em-${pedido.id}`} className="text-[11px] text-[#a8b3c4] uppercase tracking-wider">E-mail de acesso (para onde vai o código)</label>
            <input id={`em-${pedido.id}`} type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E2DDD8] px-3 py-2 text-[13px]" />
          </div>
          <label className="flex items-start gap-2 text-[13px] text-[#1a1d23]">
            <input type="checkbox" className="mt-1" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />
            Já confirmei com o cliente por telefone/WhatsApp.
          </label>
        </div>
      )}

      {msg && <p role="status" className={`text-[13px] ${msg.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.texto}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => decidir('aprovar')}
          disabled={!!ocupado || !clienteId || !confirmado || !email.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#145A5B] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#1B6E70] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ocupado === 'aprovar' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar e enviar código
        </button>
        <button
          onClick={() => decidir('rejeitar')}
          disabled={!!ocupado}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40"
        >
          {ocupado === 'rejeitar' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Rejeitar
        </button>
      </div>
    </div>
  )
}

export default function FilaPedidosAcesso({ pedidos }: { pedidos: PedidoNaFila[] }) {
  if (pedidos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E2DDD8] bg-white px-6 py-12 text-center">
        <ShieldCheck size={22} className="mx-auto text-[#a8b3c4] mb-2" />
        <p className="text-[14px] text-[#3d4a5c] font-medium">Nenhum pedido pendente</p>
        <p className="text-[12px] text-[#a8b3c4] mt-1">Quando um cliente pedir o primeiro acesso, ele aparece aqui e você recebe um aviso por e-mail.</p>
      </div>
    )
  }
  return <div className="space-y-4">{pedidos.map(p => <Pedido key={p.id} pedido={p} />)}</div>
}
