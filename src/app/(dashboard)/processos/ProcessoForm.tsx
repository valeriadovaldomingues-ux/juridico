'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ParteProcesso } from '@/types'

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
  clientes,
  parteContraria,
  onSuccess,
}: {
  processo?: any
  clientes: { id: string; nome: string }[]
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
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
        <h2 className="text-sm font-semibold text-[#1a1d23] mb-5">Identificação</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Título *</label>
            <input
              required
              value={form.titulo}
              onChange={(e) => handleChange('titulo', e.target.value)}
              placeholder="Ex: João Silva x Empresa ABC"
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Número do Processo</label>
            <input
              value={form.numero_processo}
              onChange={(e) => handleChange('numero_processo', e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Área do Direito *</label>
            <select
              value={form.area_direito}
              onChange={(e) => handleChange('area_direito', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] bg-white"
            >
              {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Status *</label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] bg-white"
            >
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="arquivado">Arquivado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Fase</label>
            <input
              value={form.fase}
              onChange={(e) => handleChange('fase', e.target.value)}
              placeholder="Ex: Instrução, Recursal..."
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10"
            />
          </div>
        </div>
      </div>

      {/* ── Partes do Processo ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-[#1a1d23]">Partes do Processo</h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            {isEditing
              ? 'Edite a parte contrária principal abaixo. Para gerenciar múltiplas partes, use a seção de Partes na tela de detalhes.'
              : 'Adicione a parte contrária principal. Após cadastrar, você poderá incluir múltiplas partes na tela de detalhes.'}
          </p>
        </div>

        <div className="space-y-4">
          {/* Cliente principal */}
          <div className="p-4 bg-[#f9fafb] rounded-xl border border-[#e5e7eb]">
            <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
              Cliente Principal
            </p>
            <select
              value={form.cliente_id}
              onChange={(e) => handleChange('cliente_id', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] bg-white"
            >
              <option value="">Selecionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          {/* Parte contrária principal */}
          <div className="p-4 bg-[#f9fafb] rounded-xl border border-[#e5e7eb]">
            <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
              Parte Contrária Principal
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome</label>
                <input
                  value={parteForm.nome}
                  onChange={(e) => setParteForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo da parte contrária"
                  className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Tipo</label>
                <select
                  value={parteForm.tipo_parte}
                  onChange={(e) => setParteForm(prev => ({ ...prev, tipo_parte: e.target.value as TipoParte }))}
                  className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] bg-white"
                >
                  <option value="reu">Réu</option>
                  <option value="autor">Autor</option>
                  <option value="terceiro">Terceiro</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-[#374151] mb-1.5">CPF / CNPJ (opcional)</label>
                <input
                  value={parteForm.documento}
                  onChange={(e) => setParteForm(prev => ({ ...prev, documento: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 font-mono bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Localização e Valores ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
        <h2 className="text-sm font-semibold text-[#1a1d23] mb-5">Localização e Valores</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Tribunal</label>
            <input
              value={form.tribunal}
              onChange={(e) => handleChange('tribunal', e.target.value)}
              placeholder="Ex: TJSP, TRT-2..."
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Vara</label>
            <input
              value={form.vara}
              onChange={(e) => handleChange('vara', e.target.value)}
              placeholder="Ex: 3ª Vara Cível"
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Distribuição</label>
            <input
              type="date"
              value={form.data_distribuicao}
              onChange={(e) => handleChange('data_distribuicao', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Valor da Causa (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.valor_causa}
              onChange={(e) => handleChange('valor_causa', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10"
            />
          </div>
        </div>
      </div>

      {/* ── Observações ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
        <label className="block text-xs font-medium text-[#374151] mb-1.5">Observações</label>
        <textarea
          value={form.observacoes}
          onChange={(e) => handleChange('observacoes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={() => onSuccess ? onSuccess() : router.push('/processos')}
          className="px-5 py-2.5 text-sm font-medium text-[#6b7280] hover:text-[#1a1d23] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
        >
          {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Processo'}
        </button>
      </div>
    </form>
  )
}
