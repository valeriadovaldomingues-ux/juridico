'use client'

import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, X, Lock } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { totaisDespesasPessoais, type DespesaPessoal, type StatusDespesaPessoal } from '@/lib/financeiro/despesas-pessoais'

export interface SocioOpcao { id: string; nome: string }

interface Props {
  iniciais: DespesaPessoal[]
  socios: SocioOpcao[]
}

const STATUS_LABEL: Record<StatusDespesaPessoal, string> = { pendente: 'Pendente', pago: 'Pago', cancelado: 'Cancelado' }

type Form = {
  descricao: string; categoria: string; valor: string; vencimento: string
  status: StatusDespesaPessoal; pagamento_em: string; socio_id: string; observacoes: string
}
const hojeISO = () => new Date().toISOString().slice(0, 10)
const formVazio = (): Form => ({ descricao: '', categoria: '', valor: '', vencimento: hojeISO(), status: 'pendente', pagamento_em: '', socio_id: '', observacoes: '' })

export default function DespesasPessoaisView({ iniciais, socios }: Props) {
  const [itens, setItens] = useState<DespesaPessoal[]>(iniciais)
  const [mes, setMes] = useState(() => hojeISO().slice(0, 7))
  const [filtroSocio, setFiltroSocio] = useState('')
  const [editando, setEditando] = useState<DespesaPessoal | 'novo' | null>(null)
  const [form, setForm] = useState<Form>(formVazio())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const nomeDoSocio = useMemo(() => new Map(socios.map(s => [s.id, s.nome])), [socios])

  const doMes = useMemo(
    () => itens
      .filter(d => (!mes || d.vencimento.slice(0, 7) === mes) && (!filtroSocio || d.socio_id === filtroSocio))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [itens, mes, filtroSocio],
  )
  const totais = useMemo(() => totaisDespesasPessoais(doMes, hojeISO()), [doMes])

  function abrir(d: DespesaPessoal | 'novo') {
    setErro('')
    setEditando(d)
    setForm(d === 'novo' ? formVazio() : {
      descricao: d.descricao, categoria: d.categoria === 'Geral' ? '' : d.categoria, valor: String(d.valor), vencimento: d.vencimento,
      status: d.status, pagamento_em: d.pagamento_em ?? '', socio_id: d.socio_id ?? '', observacoes: d.observacoes ?? '',
    })
  }

  async function salvar() {
    setSalvando(true); setErro('')
    const novo = editando === 'novo'
    const res = await fetch(novo ? '/api/financeiro/despesas-pessoais' : `/api/financeiro/despesas-pessoais/${(editando as DespesaPessoal).id}`, {
      method: novo ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, pagamento_em: form.status === 'pago' ? (form.pagamento_em || hojeISO()) : null }),
    })
    const json = await res.json().catch(() => ({}))
    setSalvando(false)
    if (!res.ok) { setErro(json.error ?? 'Não foi possível salvar.'); return }
    setItens(prev => novo ? [json, ...prev] : prev.map(i => (i.id === json.id ? json : i)))
    setEditando(null)
  }

  async function excluir(d: DespesaPessoal) {
    if (!confirm(`Apagar a despesa "${d.descricao}"? Isso não pode ser desfeito.`)) return
    const res = await fetch(`/api/financeiro/despesas-pessoais/${d.id}`, { method: 'DELETE' })
    if (res.ok) setItens(prev => prev.filter(i => i.id !== d.id))
    else alert('Não foi possível apagar.')
  }

  const campo = 'mt-1 w-full rounded-lg border border-[#E2DDD8] px-3 py-2 text-[13px]'
  const rotulo = 'text-[11px] text-[#a8b3c4] uppercase tracking-wider'

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[12px] text-[#7a8899]">
          <Lock size={12} /> Só os sócios veem esta aba. Estes valores ficam fora dos totais e relatórios de despesas do escritório.
        </p>
        <button onClick={() => abrir('novo')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#145A5B] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#1B6E70]">
          <Plus size={13} /> Nova despesa pessoal
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={rotulo} htmlFor="dp-mes">Mês</label>
          <input id="dp-mes" type="month" value={mes} onChange={e => setMes(e.target.value)} className={cn(campo, 'w-auto')} />
        </div>
        <div>
          <label className={rotulo} htmlFor="dp-socio">Sócio</label>
          <select id="dp-socio" value={filtroSocio} onChange={e => setFiltroSocio(e.target.value)} className={cn(campo, 'w-auto')}>
            <option value="">Todos</option>
            {socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        {mes && <button onClick={() => setMes('')} className="text-[12px] text-[#145A5B] underline pb-2">Ver todos os meses</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Total', totais.total, 'text-[#374151]'], ['Pago', totais.pago, 'text-emerald-700'],
          ['A vencer', totais.pendente, 'text-amber-700'], ['Vencido', totais.vencido, 'text-rose-700'],
        ].map(([rot, val, cor]) => (
          <div key={rot as string} className="rounded-lg border border-[#E2DDD8] p-3">
            <p className={rotulo}>{rot as string}</p>
            <p className={cn('text-[17px] font-semibold', cor as string)}>{formatCurrency(val as number)}</p>
          </div>
        ))}
      </div>

      {doMes.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#7a8899]">Nenhuma despesa pessoal neste período.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2DDD8]">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f9fafb] text-left text-[11px] uppercase tracking-wider text-[#a8b3c4]">
              <tr><th className="px-3 py-2">Vencimento</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Sócio</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {doMes.map(d => {
                const vencido = d.status === 'pendente' && d.vencimento < hojeISO()
                return (
                  <tr key={d.id} className="border-t border-[#f3f4f6]">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(d.vencimento)}</td>
                    <td className="px-3 py-2">{d.descricao}{d.observacoes && <span className="block text-[11px] text-[#7a8899]">{d.observacoes}</span>}</td>
                    <td className="px-3 py-2">{(d.socio_id && nomeDoSocio.get(d.socio_id)) || '—'}</td>
                    <td className="px-3 py-2">{d.categoria}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(d.valor)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', d.status === 'pago' ? 'bg-[#e6f4ee] text-[#1a7a45]' : vencido ? 'bg-[#fde8e8] text-[#a93226]' : d.status === 'cancelado' ? 'bg-[#F3F1EE] text-[#7a8899]' : 'bg-[#fef8ec] text-[#8a6000]')}>
                        {vencido ? 'Vencido' : STATUS_LABEL[d.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <button onClick={() => abrir(d)} aria-label="Editar" className="p-1.5 text-[#7a8899] hover:text-[#145A5B]"><Pencil size={14} /></button>
                      <button onClick={() => excluir(d)} aria-label="Apagar" className="p-1.5 text-[#7a8899] hover:text-rose-700"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Despesa pessoal">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">{editando === 'novo' ? 'Nova despesa pessoal' : 'Editar despesa pessoal'}</h3>
              <button onClick={() => setEditando(null)} aria-label="Fechar"><X size={16} /></button>
            </div>
            <div><label className={rotulo} htmlFor="dp-desc">Descrição</label><input id="dp-desc" className={campo} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="dp-valor">Valor (R$)</label><input id="dp-valor" inputMode="decimal" className={campo} value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value.replace(',', '.') })} /></div>
              <div><label className={rotulo} htmlFor="dp-venc">Vencimento</label><input id="dp-venc" type="date" className={campo} value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="dp-status">Status</label>
                <select id="dp-status" className={campo} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as StatusDespesaPessoal })}>
                  {(Object.keys(STATUS_LABEL) as StatusDespesaPessoal[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select></div>
              {form.status === 'pago' && <div><label className={rotulo} htmlFor="dp-pgto">Pago em</label><input id="dp-pgto" type="date" className={campo} value={form.pagamento_em} onChange={e => setForm({ ...form, pagamento_em: e.target.value })} /></div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="dp-socio-f">Sócio</label>
                <select id="dp-socio-f" className={campo} value={form.socio_id} onChange={e => setForm({ ...form, socio_id: e.target.value })}>
                  <option value="">—</option>{socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select></div>
              <div><label className={rotulo} htmlFor="dp-cat">Categoria</label><input id="dp-cat" className={campo} placeholder="Geral" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} /></div>
            </div>
            <div><label className={rotulo} htmlFor="dp-obs">Observações</label><textarea id="dp-obs" rows={2} className={campo} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            {erro && <p role="alert" className="text-[12px] text-rose-700">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditando(null)} className="rounded-lg border border-[#E2DDD8] px-3 py-2 text-[12px]">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-[#145A5B] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-40">
                {salvando && <Loader2 size={12} className="animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
