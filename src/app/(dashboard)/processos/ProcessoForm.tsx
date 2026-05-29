'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { createClient } from '@/lib/supabase/client'
import type { ParteProcesso } from '@/types'
import { buildClienteLookupDescription } from '@/lib/processos/search'

type TipoParte = 'autor' | 'reu' | 'terceiro' | 'outro'

const areaOptions = [
  { value: 'civil', label: 'Cível' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'familia', label: 'Família' },
  { value: 'empresarial', label: 'Empresarial' },
  { value: 'outro', label: 'Outro' },
]

const sectionClass = 'bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-[0_12px_36px_rgba(13,34,53,0.05)]'
const sectionTitleClass = 'font-brand text-[24px] font-semibold text-[var(--color-ink)] mb-5'
const labelClass = 'block text-xs font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.08em]'
const inputClass = 'w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 bg-white text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] transition-all'
const panelClass = 'p-4 bg-[var(--color-surface-warm)] rounded-xl border border-[var(--color-border)]'

/**
 * Estado da parte contrária exibida no formulário.
 * `id` está presente quando estamos editando uma parte já cadastrada,
 * permitindo upsert seguro sem duplicatas.
 * A tabela `partes_processo` suporta N partes por processo —
 * outras partes são gerenciadas na tela de detalhes.
 */
interface ParteContrariaForm {
  id?: string
  nome: string
  tipo_parte: TipoParte
  documento: string
}

export default function ProcessoForm({
  processo,
  parteContraria,
  onSuccess,
}: {
  processo?: any
  /** Parte contrária pré-carregada (na edição). Apenas a primeira é exibida aqui;
   *  as demais são gerenciadas na tela de detalhes do processo. */
  parteContraria?: ParteProcesso | null
  onSuccess?: () => void
}) {
  const router = useRouter()
  const isEditing = !!processo

  const [form, setForm] = useState({
    titulo: processo?.titulo ?? '',
    numero_processo: processo?.numero_processo ?? '',
    area_direito: processo?.area_direito ?? 'civil',
    status: processo?.status ?? 'ativo',
    fase: processo?.fase ?? '',
    cliente_id: processo?.cliente_id ?? '',
    tribunal: processo?.tribunal ?? '',
    vara: processo?.vara ?? '',
    valor_causa: processo?.valor_causa ?? '',
    data_distribuicao: processo?.data_distribuicao ?? '',
    observacoes: processo?.observacoes ?? '',
  })

  const [parteForm, setParteForm] = useState<ParteContrariaForm>({
    id: parteContraria?.id,
    nome: parteContraria?.pessoa_nome ?? '',
    tipo_parte: (parteContraria?.tipo_parte as TipoParte) ?? 'reu',
    documento: parteContraria?.documento ?? '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    const payload = {
      ...form,
      numero_processo: form.numero_processo || null,
      fase: form.fase || null,
      cliente_id: form.cliente_id || null,
      tribunal: form.tribunal || null,
      vara: form.vara || null,
      valor_causa: form.valor_causa ? parseFloat(form.valor_causa.toString()) : null,
      data_distribuicao: form.data_distribuicao || null,
      observacoes: form.observacoes || null,
    }

    // ── Salvar processo ──────────────────────────────────────────────────────
    let processoId: string

    if (isEditing) {
      const { error: errUpdate } = await supabase
        .from('processos')
        .update(payload)
        .eq('id', processo.id)
      if (errUpdate) { setError(errUpdate.message); setLoading(false); return }
      processoId = processo.id
    } else {
      // Retorna o id para vincular a parte contrária ao processo recém-criado
      const { data: novo, error: errInsert } = await supabase
        .from('processos')
        .insert(payload)
        .select('id')
        .single()
      if (errInsert || !novo) {
        setError(errInsert?.message ?? 'Erro ao criar processo')
        setLoading(false)
        return
      }
      processoId = novo.id
    }

    // ── Salvar parte contrária (se preenchida) ───────────────────────────────
    // A tabela partes_processo suporta múltiplas partes.
    // Aqui gerenciamos apenas a "parte contrária principal" do formulário.
    // Partes adicionais são gerenciadas na tela de detalhes do processo.
    if (parteForm.nome.trim()) {
      const partPayload = {
        processo_id: processoId,
        pessoa_nome: parteForm.nome.trim(),
        tipo_parte: parteForm.tipo_parte,
        documento: parteForm.documento.trim() || null,
        observacoes: null as string | null,
      }

      if (parteForm.id) {
        // Atualizar parte existente — sem risco de duplicata
        const { error: errParte } = await supabase
          .from('partes_processo')
          .update(partPayload)
          .eq('id', parteForm.id)
        if (errParte) { setError(errParte.message); setLoading(false); return }
      } else {
        // Inserir nova parte e guardar o id gerado para evitar duplicatas
        const { data: novaParte, error: errParte } = await supabase
          .from('partes_processo')
          .insert(partPayload)
          .select('id')
          .single()
        if (errParte) { setError(errParte.message); setLoading(false); return }
        setParteForm(prev => ({ ...prev, id: novaParte?.id }))
      }
    }

    if (onSuccess) {
      onSuccess()
    } else {
      router.push('/processos')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Identificação ──────────────────────────────────────────────────── */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>Identificação</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Título *</label>
            <input
              required
              value={form.titulo}
              onChange={(e) => handleChange('titulo', e.target.value)}
              placeholder="Ex: João Silva x Empresa ABC"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Número do Processo</label>
            <input
              value={form.numero_processo}
              onChange={(e) => handleChange('numero_processo', e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
              className={`${inputClass} font-mono`}
            />
          </div>

          <div>
            <label className={labelClass}>Área do Direito *</label>
            <select
              value={form.area_direito}
              onChange={(e) => handleChange('area_direito', e.target.value)}
              className={inputClass}
            >
              {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Status *</label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className={inputClass}
            >
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="arquivado">Arquivado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Fase</label>
            <input
              value={form.fase}
              onChange={(e) => handleChange('fase', e.target.value)}
              placeholder="Ex: Instrução, Recursal..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Partes do Processo ─────────────────────────────────────────────── */}
      <div className={sectionClass}>
        <div className="mb-5">
          <h2 className="font-brand text-[24px] font-semibold text-[var(--color-ink)]">Partes do Processo</h2>
          <p className="text-xs text-[var(--color-ink-3)] mt-0.5">
            {isEditing
              ? 'Edite a parte contrária principal abaixo. Para gerenciar múltiplas partes, use a seção de Partes na tela de detalhes.'
              : 'Adicione a parte contrária principal. Após cadastrar, você poderá incluir múltiplas partes na tela de detalhes.'}
          </p>
        </div>

        <div className="space-y-4">
          {/* Cliente principal */}
          <div className={panelClass}>
            <p className="text-[11px] font-semibold text-[var(--color-copper)] uppercase tracking-[0.12em] mb-2">
              Cliente Principal
            </p>
            <SearchableCombobox
              value={form.cliente_id}
              selectedOption={processo?.cliente?.id ? {
                value: processo.cliente.id,
                label: processo.cliente.nome,
                description: buildClienteLookupDescription(processo.cliente),
              } : null}
              onChange={(value) => handleChange('cliente_id', value)}
              loadOptions={async (query) => {
                const params = new URLSearchParams({ q: query, limit: '10' })
                const res = await fetch(`/api/clientes/busca?${params.toString()}`)
                if (!res.ok) return []
                const data = await res.json()
                return (data as Array<{
                  id: string
                  nome: string
                  cpf_cnpj: string | null
                  telefone: string | null
                  celular: string | null
                  email: string | null
                }>).map(cliente => ({
                  value: cliente.id,
                  label: cliente.nome,
                  description: buildClienteLookupDescription(cliente),
                }))
              }}
              placeholder="Selecionar cliente..."
              searchPlaceholder="Buscar cliente por nome, CPF/CNPJ, telefone ou e-mail"
              helperText="Digite ao menos 2 caracteres."
              emptyText="Digite para buscar clientes."
              noResultsText="Nenhum resultado encontrado."
              allowClear
              createHref="/clientes/novo"
              createLabel="Cadastrar novo"
            />
          </div>

          {/* Parte contrária principal */}
          <div className={panelClass}>
            <p className="text-[11px] font-semibold text-[var(--color-copper)] uppercase tracking-[0.12em] mb-3">
              Parte Contrária Principal
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Nome</label>
                <input
                  value={parteForm.nome}
                  onChange={(e) => setParteForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo da parte contrária"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select
                  value={parteForm.tipo_parte}
                  onChange={(e) => setParteForm(prev => ({ ...prev, tipo_parte: e.target.value as TipoParte }))}
                  className={inputClass}
                >
                  <option value="reu">Réu</option>
                  <option value="autor">Autor</option>
                  <option value="terceiro">Terceiro</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className={labelClass}>CPF / CNPJ (opcional)</label>
                <input
                  value={parteForm.documento}
                  onChange={(e) => setParteForm(prev => ({ ...prev, documento: e.target.value }))}
                  placeholder="Opcional"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Localização e Valores ──────────────────────────────────────────── */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>Localização e Valores</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Tribunal</label>
            <input
              value={form.tribunal}
              onChange={(e) => handleChange('tribunal', e.target.value)}
              placeholder="Ex: TJSP, TRT-2..."
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Vara</label>
            <input
              value={form.vara}
              onChange={(e) => handleChange('vara', e.target.value)}
              placeholder="Ex: 3ª Vara Cível"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Distribuição</label>
            <input
              type="date"
              value={form.data_distribuicao}
              onChange={(e) => handleChange('data_distribuicao', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Valor da Causa (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.valor_causa}
              onChange={(e) => handleChange('valor_causa', e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Observações ────────────────────────────────────────────────────── */}
      <div className={sectionClass}>
        <label className={labelClass}>Observações</label>
        <textarea
          value={form.observacoes}
          onChange={(e) => handleChange('observacoes', e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={() => onSuccess ? onSuccess() : router.push('/processos')}
          className="px-5 py-2.5 text-sm font-medium text-[var(--color-ink-3)] hover:text-[var(--color-ink)] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-sm"
        >
          {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Processo'}
        </button>
      </div>
    </form>
  )
}
