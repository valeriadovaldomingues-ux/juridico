'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import {
  fetchClienteOptions,
  fetchProcessoOptions,
} from '@/lib/search/remote'

interface LancamentoForm {
  id?:          string
  tipo:         'receita' | 'despesa'
  descricao:    string
  categoria:    string
  valor:        string
  vencimento:   string
  pagamento_em: string
  status:       'pendente' | 'pago' | 'vencido' | 'cancelado'
  cliente_id:   string
  processo_id:  string
  centro_custo: string
}

const FORM_VAZIO: LancamentoForm = {
  tipo:         'receita',
  descricao:    '',
  categoria:    '',
  valor:        '',
  vencimento:   new Date().toISOString().slice(0, 10),
  pagamento_em: '',
  status:       'pendente',
  cliente_id:   '',
  processo_id:  '',
  centro_custo: '',
}

interface Props {
  lancamento:  (Partial<LancamentoForm> & {
    cliente?: { id: string; nome: string; cpf_cnpj?: string | null; telefone?: string | null; celular?: string | null; email?: string | null } | null
    processo?: { id: string; numero_processo: string | null; titulo: string; description?: string | null } | null
  }) | null
  onSalvar:    (data: LancamentoForm) => Promise<string | null>
  onFechar:    () => void
}

export default function LancamentoModal({ lancamento, onSalvar, onFechar }: Props) {
  const [form,    setForm]    = useState<LancamentoForm>(FORM_VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState('')

  const isEdicao = !!lancamento?.id

  useEffect(() => {
    if (lancamento) {
      setForm({
        ...FORM_VAZIO,
        ...lancamento,
        valor:        lancamento.valor?.toString() ?? '',
        pagamento_em: lancamento.pagamento_em ?? '',
        cliente_id:   lancamento.cliente_id   ?? '',
        processo_id:  lancamento.processo_id  ?? '',
        centro_custo: lancamento.centro_custo ?? '',
        categoria:    lancamento.categoria    ?? '',
      })
    } else {
      setForm(FORM_VAZIO)
    }
    setErro('')
  }, [lancamento])

  function set<K extends keyof LancamentoForm>(k: K, v: LancamentoForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descricao.trim()) { setErro('Informe a descrição'); return }
    if (!form.valor || isNaN(parseFloat(form.valor)) || parseFloat(form.valor) <= 0) {
      setErro('Informe um valor válido'); return
    }
    if (!form.vencimento) { setErro('Informe a data de vencimento'); return }

    setErro('')
    setLoading(true)
    const err = await onSalvar(form)
    setLoading(false)
    if (err) setErro(err)
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8] transition-all'
  const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <h2 className="text-[15px] font-semibold text-[#0f1923]">
            {isEdicao ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Tipo */}
          <div>
            <p className={labelCls}>Tipo <span className="text-red-500 normal-case font-normal">*</span></p>
            <div className="flex gap-2">
              {(['receita', 'despesa'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tipo', t)}
                  className={cn(
                    'flex-1 py-2 text-[13px] font-semibold rounded-xl border transition-all',
                    form.tipo === t
                      ? t === 'receita'
                        ? 'bg-[#e6f4ee] border-[#b8dfc9] text-[#1a7a45]'
                        : 'bg-[#fde8e8] border-[#f5c6c6] text-[#a93226]'
                      : 'bg-[#f9fafb] border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]',
                  )}
                >
                  {t === 'receita' ? 'Receita' : 'Despesa'}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className={labelCls}>Descrição <span className="text-red-500 normal-case font-normal">*</span></label>
            <input
              type="text"
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Ex: Honorários advocatícios — João Silva"
              className={inputCls}
            />
          </div>

          {/* Categoria */}
          <div>
            <label className={labelCls}>Categoria</label>
            <input
              type="text"
              value={form.categoria}
              onChange={e => set('categoria', e.target.value)}
              placeholder={form.tipo === 'receita' ? 'Ex: Honorários, Custas' : 'Ex: Escritório, Pessoal'}
              className={inputCls}
            />
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Valor (R$) <span className="text-red-500 normal-case font-normal">*</span></label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.valor}
                onChange={e => set('valor', e.target.value)}
                placeholder="0,00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Vencimento <span className="text-red-500 normal-case font-normal">*</span></label>
              <input
                type="date"
                value={form.vencimento}
                onChange={e => set('vencimento', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Status + Pagamento em */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as LancamentoForm['status'])}
                className={inputCls}
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            {form.status === 'pago' && (
              <div>
                <label className={labelCls}>Pago em</label>
                <input
                  type="date"
                  value={form.pagamento_em}
                  onChange={e => set('pagamento_em', e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Cliente */}
          <div>
            <label className={labelCls}>Cliente</label>
            <SearchableCombobox
              value={form.cliente_id}
              selectedOption={lancamento?.cliente?.id ? {
                value: lancamento.cliente.id,
                label: lancamento.cliente.nome,
                description: [lancamento.cliente.cpf_cnpj, lancamento.cliente.telefone ?? lancamento.cliente.celular, lancamento.cliente.email]
                  .filter(Boolean)
                  .join(' · ') || null,
              } : null}
              onChange={(value) => { set('cliente_id', value); set('processo_id', '') }}
              loadOptions={async (query) => fetchClienteOptions(query, 10)}
              placeholder="— Sem cliente —"
              searchPlaceholder="Buscar cliente por nome, CPF/CNPJ, telefone ou e-mail"
              helperText="Digite ao menos 2 caracteres."
              emptyText="Digite para buscar clientes."
              noResultsText="Nenhum resultado encontrado."
              allowClear
            />
          </div>

          {/* Processo */}
          <div>
            <label className={labelCls}>Processo</label>
            <SearchableCombobox
              value={form.processo_id}
              selectedOption={lancamento?.processo?.id ? {
                value: lancamento.processo.id,
                label: lancamento.processo.numero_processo ? `${lancamento.processo.numero_processo} — ${lancamento.processo.titulo}` : lancamento.processo.titulo,
                description: lancamento.processo.description ?? lancamento.processo.numero_processo ?? null,
              } : null}
              onChange={(value) => set('processo_id', value)}
              loadOptions={async (query) => fetchProcessoOptions(query, 10)}
              placeholder="— Sem processo —"
              searchPlaceholder="Buscar processo por número, cliente ou parte contrária"
              helperText="Digite ao menos 2 caracteres."
              emptyText="Digite para buscar processos."
              noResultsText="Nenhum resultado encontrado."
              allowClear
            />
          </div>

          {/* Centro de custo */}
          <div>
            <label className={labelCls}>Centro de custo</label>
            <input
              type="text"
              value={form.centro_custo}
              onChange={e => set('centro_custo', e.target.value)}
              placeholder="Ex: Escritório central, Filial"
              className={inputCls}
            />
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
          )}

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-[#1D5F60] hover:bg-[#27777A] text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {loading ? 'Salvando…' : isEdicao ? 'Salvar alterações' : 'Criar lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
