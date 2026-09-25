'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Users, X, Loader2, FileDown, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Folha {
  id?:                string
  profile_id:         string
  mes_referencia:      string
  dias_uteis:         number | null
  salario_base:       number
  salario_base_nota:  string | null
  extra:              number
  extra_nota:         string | null
  partido_3_5:        number
  partido_20:         number
  alimentacao:        number
  transporte:         number
  desconto:           number
  desconto_nota:      string | null
  gratificacao:       number
  ferias_um_terco:    number
  adiantamento:       number
  forma_pagamento:    string | null
  observacoes:        string | null
  total?:             number
}

export type TipoRecibo = 'advogado' | 'funcionario_unico' | 'estagiario' | 'funcionario_dividido'

export interface FuncionarioFolha {
  profile_id:     string
  nome:           string
  email:          string
  role:           string
  folha:          Folha | null
  tipoRecibo:     TipoRecibo | null
  dadosCompletos: boolean
}

interface Props {
  mesInicial:        string // 'YYYY-MM-01'
  funcionariosIniciais: FuncionarioFolha[]
}

const ROLE_LABEL: Record<string, string> = {
  advogado: 'Advogado(a)', gerente: 'Gerente', administrativo: 'Administrativo',
  comercial: 'Comercial', estagiario: 'Estagiário(a)',
}
const ROLE_ORDEM = ['gerente', 'advogado', 'administrativo', 'comercial', 'estagiario']

const FOLHA_VAZIA = (profile_id: string, mes_referencia: string): Folha => ({
  profile_id, mes_referencia, dias_uteis: null,
  salario_base: 0, salario_base_nota: null,
  extra: 0, extra_nota: null,
  partido_3_5: 0, partido_20: 0,
  alimentacao: 0, transporte: 0,
  desconto: 0, desconto_nota: null,
  gratificacao: 0, ferias_um_terco: 0, adiantamento: 0,
  forma_pagamento: null, observacoes: null,
})

function calcularTotal(f: Folha): number {
  return f.salario_base + f.extra + f.partido_3_5 + f.partido_20 + f.alimentacao
    + f.transporte + f.gratificacao + f.ferias_um_terco - f.desconto - f.adiantamento
}

function mesLabel(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${nomes[m - 1]}/${y}`
}

function somarMes(mes: string, delta: number) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function SalariosView({ mesInicial, funcionariosIniciais }: Props) {
  const [mes, setMes] = useState(mesInicial)
  const [funcionarios, setFuncionarios] = useState<FuncionarioFolha[]>(funcionariosIniciais)
  const [carregando, setCarregando] = useState(false)
  const [editando, setEditando] = useState<FuncionarioFolha | null>(null)

  async function irParaMes(novoMes: string) {
    setMes(novoMes)
    if (novoMes === mesInicial) { setFuncionarios(funcionariosIniciais); return }
    setCarregando(true)
    try {
      const res = await fetch(`/api/financeiro/folha-pagamento?mes=${novoMes}`)
      setFuncionarios(await res.json())
    } finally {
      setCarregando(false)
    }
  }

  const agrupados = useMemo(() => {
    const grupos: Record<string, FuncionarioFolha[]> = {}
    funcionarios.forEach(f => { grupos[f.role] = grupos[f.role] ?? []; grupos[f.role].push(f) })
    return ROLE_ORDEM.filter(r => grupos[r]?.length).map(r => ({ role: r, itens: grupos[r] }))
  }, [funcionarios])

  const totalFolha = useMemo(
    () => funcionarios.reduce((s, f) => s + (f.folha ? calcularTotal(f.folha) : 0), 0),
    [funcionarios],
  )

  function abrirEdicao(f: FuncionarioFolha) { setEditando(f) }

  function aplicarSalvo(folha: Folha) {
    setFuncionarios(prev => prev.map(f => f.profile_id === folha.profile_id ? { ...f, folha } : f))
    setEditando(null)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Cabeçalho: mês + resumo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => irParaMes(somarMes(mes, -1))} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <p className="text-[14px] font-semibold text-[#0f1923] w-32 text-center">{mesLabel(mes)}</p>
          <button onClick={() => irParaMes(somarMes(mes, 1))} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <ChevronRight size={16} />
          </button>
          {carregando && <Loader2 size={14} className="animate-spin text-[#9ca3af] ml-2" />}
        </div>
        <div className="bg-[#f9fafb] rounded-xl px-4 py-2.5 border border-[#f3f4f6] text-right">
          <p className="text-[11px] text-[#9ca3af]">Total da folha em {mesLabel(mes)}</p>
          <p className="text-[18px] font-bold text-[#0f1923] tabular-nums">{formatCurrency(totalFolha)}</p>
        </div>
      </div>

      {agrupados.map(({ role, itens }) => (
        <div key={role}>
          <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users size={12} /> {ROLE_LABEL[role] ?? role} <span className="text-[#c5cdd8]">({itens.length})</span>
          </p>
          <div className="rounded-xl border border-[#f3f4f6] overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Nome</th>
                <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Salário base</th>
                <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Extra</th>
                <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Partido</th>
                <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Benefícios</th>
                <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Descontos</th>
                <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Total</th>
                <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Recibo</th>
                <th className="w-10"></th>
              </tr></thead>
              <tbody>
                {itens.map(f => {
                  const folha = f.folha
                  const beneficios = (folha?.alimentacao ?? 0) + (folha?.transporte ?? 0)
                  const total = folha ? calcularTotal(folha) : 0
                  return (
                    <tr key={f.profile_id} className="border-b border-[#f9fafb] last:border-0 hover:bg-[#fafbfb]">
                      <td className="px-4 py-2.5 text-[13px] text-[#374151]">
                        {f.nome}
                        {folha?.dias_uteis != null && <span className="block text-[11px] text-[#9ca3af]">{folha.dias_uteis} dias úteis</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] text-[#374151] tabular-nums">
                        {formatCurrency(folha?.salario_base ?? 0)}
                        {folha?.salario_base_nota && <span className="block text-[11px] text-[#9ca3af]">{folha.salario_base_nota}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] text-[#374151] tabular-nums">{formatCurrency(folha?.extra ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right text-[13px] text-[#374151] tabular-nums">
                        {formatCurrency((folha?.partido_3_5 ?? 0) + (folha?.partido_20 ?? 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] text-[#374151] tabular-nums">{formatCurrency(beneficios)}</td>
                      <td className="px-4 py-2.5 text-right text-[13px] text-[#a93226] tabular-nums">
                        {folha && (folha.desconto + folha.adiantamento) > 0 ? `- ${formatCurrency(folha.desconto + folha.adiantamento)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold text-[#0f1923] tabular-nums">{formatCurrency(total)}</td>
                      <td className="px-4 py-2.5">
                        <BotoesRecibo funcionario={f} mes={mes} />
                      </td>
                      <td className="px-2 py-2.5">
                        <button onClick={() => abrirEdicao(f)} title="Editar folha"
                          className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#1D5F60] hover:bg-[#f0f7f7] transition-colors">
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {funcionarios.length === 0 && !carregando && (
        <p className="text-[13px] text-[#9ca3af] text-center py-8">Nenhum funcionário ativo encontrado.</p>
      )}

      {editando && (
        <FolhaModal
          funcionario={editando}
          mes={mes}
          onFechar={() => setEditando(null)}
          onSalvo={aplicarSalvo}
        />
      )}
    </div>
  )
}

// ─── Modal de edição ─────────────────────────────────────────────────────────

const FORMA_LABEL: Record<string, string> = { pix: 'Pix', ted: 'TED', dinheiro: 'Dinheiro', outro: 'Outro' }

function FolhaModal({ funcionario, mes, onFechar, onSalvo }: {
  funcionario: FuncionarioFolha
  mes: string
  onFechar: () => void
  onSalvo: (folha: Folha) => void
}) {
  const [form, setForm] = useState<Folha>(funcionario.folha ?? FOLHA_VAZIA(funcionario.profile_id, mes))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set<K extends keyof Folha>(k: K, v: Folha[K]) { setForm(prev => ({ ...prev, [k]: v })) }
  const num = (v: string) => v === '' ? 0 : Number(v)

  async function salvar() {
    setSalvando(true)
    setErro('')
    const res = await fetch('/api/financeiro/folha-pagamento', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    setSalvando(false)
    if (res.ok) {
      onSalvo(await res.json())
    } else {
      const body = await res.json().catch(() => ({}))
      setErro(body.error ?? 'Erro ao salvar')
    }
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8] transition-all'
  const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'
  const total = calcularTotal(form)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0f1923]">{funcionario.nome}</h2>
            <p className="text-[12px] text-[#9ca3af]">{mesLabel(mes)}</p>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Dias úteis</label>
              <input type="number" min="0" max="31" value={form.dias_uteis ?? ''} onChange={e => set('dias_uteis', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Forma de pagamento</label>
              <select value={form.forma_pagamento ?? ''} onChange={e => set('forma_pagamento', e.target.value || null)} className={inputCls}>
                <option value="">—</option>
                {Object.entries(FORMA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Salário / Ajuda de custo (R$)</label>
              <input type="number" step="0.01" value={form.salario_base} onChange={e => set('salario_base', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nota (ex: 6,5 s.m.)</label>
              <input value={form.salario_base_nota ?? ''} onChange={e => set('salario_base_nota', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Extra (R$)</label>
              <input type="number" step="0.01" value={form.extra} onChange={e => set('extra', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Motivo do extra</label>
              <input value={form.extra_nota ?? ''} onChange={e => set('extra_nota', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Partido (3,5%)</label>
              <input type="number" step="0.01" value={form.partido_3_5} onChange={e => set('partido_3_5', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Partido (20%)</label>
              <input type="number" step="0.01" value={form.partido_20} onChange={e => set('partido_20', num(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Alimentação (R$)</label>
              <input type="number" step="0.01" value={form.alimentacao} onChange={e => set('alimentacao', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Transporte (R$)</label>
              <input type="number" step="0.01" value={form.transporte} onChange={e => set('transporte', num(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Gratificação (R$)</label>
              <input type="number" step="0.01" value={form.gratificacao} onChange={e => set('gratificacao', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>1/3 Férias (R$)</label>
              <input type="number" step="0.01" value={form.ferias_um_terco} onChange={e => set('ferias_um_terco', num(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Desconto (R$)</label>
              <input type="number" step="0.01" value={form.desconto} onChange={e => set('desconto', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Motivo do desconto</label>
              <input value={form.desconto_nota ?? ''} onChange={e => set('desconto_nota', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Adiantamento (R$)</label>
            <input type="number" step="0.01" value={form.adiantamento} onChange={e => set('adiantamento', num(e.target.value))} className={cn(inputCls, 'max-w-[200px]')} />
          </div>

          <div>
            <label className={labelCls}>Observações</label>
            <textarea rows={2} value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} className={cn(inputCls, 'resize-none')} />
          </div>

          <div className="flex items-center justify-between bg-[#f0f7f7] rounded-xl px-4 py-3 border border-[#145A5B]/15">
            <span className="text-[12px] font-semibold text-[#1D5F60] uppercase tracking-wider">Total</span>
            <span className="text-[18px] font-bold text-[#1D5F60] tabular-nums">{formatCurrency(total)}</span>
          </div>

          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onFechar} className="flex-1 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-[#1D5F60] hover:bg-[#27777A] text-white rounded-xl transition-colors disabled:opacity-50">
              {salvando && <Loader2 size={13} className="animate-spin" />}
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Botões de recibo ────────────────────────────────────────────────────────

function abrirRecibo(profileId: string, mes: string, parte?: string) {
  const url = `/api/financeiro/folha-pagamento/${profileId}/recibo?mes=${mes}${parte ? `&parte=${parte}` : ''}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function BotaoRecibo({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#1D5F60] border border-[#145A5B]/25 rounded-lg hover:bg-[#E8F2F2] transition-colors"
    >
      <FileDown size={11} /> {children}
    </button>
  )
}

function BotoesRecibo({ funcionario, mes }: { funcionario: FuncionarioFolha; mes: string }) {
  if (!funcionario.folha) return <span className="text-[11px] text-[#c5cdd8]">sem folha</span>

  if (!funcionario.dadosCompletos) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-[#a93226]" title="Faltam CPF/endereço no cadastro">
        <AlertTriangle size={11} /> Faltam dados
      </span>
    )
  }

  if (funcionario.tipoRecibo === 'funcionario_dividido') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <BotaoRecibo onClick={() => abrirRecibo(funcionario.profile_id, mes, 'transporte')}>Transporte</BotaoRecibo>
        <BotaoRecibo onClick={() => abrirRecibo(funcionario.profile_id, mes, 'alimentacao')}>Alimentação</BotaoRecibo>
        <BotaoRecibo onClick={() => abrirRecibo(funcionario.profile_id, mes)}>Resto</BotaoRecibo>
      </div>
    )
  }

  return <BotaoRecibo onClick={() => abrirRecibo(funcionario.profile_id, mes)}>Recibo</BotaoRecibo>
}
