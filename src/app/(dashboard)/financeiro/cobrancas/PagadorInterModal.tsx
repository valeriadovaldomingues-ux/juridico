'use client'

import { useState } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Cobranca } from '@/types/cobrancas'

interface Props {
  cobranca: Cobranca
  onClose: () => void
  onEmitted: (updated: Cobranca) => void
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] focus:outline-none focus:border-[#0F3D3E]'
const labelCls = 'block text-[12px] font-medium text-[#34495e] mb-1'

/** Conferência/complemento dos dados do pagador antes de emitir no Inter.
 *
 * A API de boleto/Pix do Inter exige CPF/CNPJ + endereço completo do
 * pagador — sem isso a emissão inteira é recusada. Em vez de deixar a
 * usuária descobrir isso só no erro (e ter que ir editar o cliente em
 * outra tela), mostramos aqui o que já temos pra ela conferir, e um
 * jeito de completar o que falta sem sair da tela de cobrança — o que
 * for preenchido já fica salvo no cadastro do cliente.
 */
export default function PagadorInterModal({ cobranca, onClose, onEmitted }: Props) {
  const cliente = cobranca.cliente

  const [form, setForm] = useState({
    cpf_cnpj:    cliente?.cpf_cnpj    ?? '',
    tipo_pessoa: cliente?.tipo_pessoa ?? '',
    cep:         cliente?.cep         ?? '',
    endereco:    cliente?.endereco    ?? '',
    numero:      cliente?.numero      ?? '',
    complemento: cliente?.complemento ?? '',
    bairro:      cliente?.bairro      ?? '',
    cidade:      cliente?.cidade      ?? '',
    uf:          cliente?.uf          ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [erro,   setErro]   = useState('')

  function set<K extends keyof typeof form>(campo: K, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  const camposObrigatorios: Array<{ campo: keyof typeof form; label: string }> = [
    { campo: 'cpf_cnpj',    label: 'CPF/CNPJ' },
    { campo: 'tipo_pessoa', label: 'Tipo de pessoa' },
    { campo: 'cep',         label: 'CEP' },
    { campo: 'endereco',    label: 'Endereço' },
    { campo: 'cidade',      label: 'Cidade' },
    { campo: 'uf',          label: 'UF' },
  ]

  async function confirmarEEmitir() {
    setErro('')

    const faltando = camposObrigatorios.filter(({ campo }) => !form[campo].trim())
    if (faltando.length > 0) {
      setErro(`Preencha: ${faltando.map(f => f.label).join(', ')}.`)
      return
    }
    if (!cliente?.id) {
      setErro('Cobrança sem cliente vinculado.')
      return
    }

    setSaving(true)
    try {
      // Salva o que foi conferido/preenchido no cadastro do cliente — assim
      // da próxima vez que ele for cobrado, os dados já estarão completos.
      const supabase = createClient()
      const { error: erroUpdate } = await supabase
        .from('clientes')
        .update({
          cpf_cnpj:    form.cpf_cnpj.trim(),
          tipo_pessoa: form.tipo_pessoa,
          cep:         form.cep.trim(),
          endereco:    form.endereco.trim(),
          numero:      form.numero.trim()      || null,
          complemento: form.complemento.trim() || null,
          bairro:      form.bairro.trim()      || null,
          cidade:      form.cidade.trim(),
          uf:          form.uf.trim().toUpperCase(),
        })
        .eq('id', cliente.id)

      if (erroUpdate) {
        setErro('Erro ao salvar dados do cliente: ' + erroUpdate.message)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/financeiro/cobrancas/${cobranca.id}/emitir-inter`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setSaving(false)

      if (!res.ok) {
        setErro(data.error ?? 'Erro ao emitir no Inter.')
        return
      }

      onEmitted(data)
      onClose()
    } catch (e) {
      setSaving(false)
      setErro(e instanceof Error ? e.message : 'Erro inesperado.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-6 pt-6 pb-3 border-b border-[#f3f4f6] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-[#0f1923]">Confirmar dados do pagador</h2>
            <p className="text-[12px] text-[#7a8899] mt-0.5">
              O Inter exige CPF/CNPJ e endereço completos pra emitir boleto/Pix. Confira ou complete abaixo.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#f3f4f6] text-[#9ca3af] shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-[#f9fafb] rounded-lg px-3 py-2.5 text-[13px]">
            <span className="text-[#7a8899]">Cliente: </span>
            <span className="font-semibold text-[#0f1923]">{cliente?.nome ?? 'Sem cliente vinculado'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>CPF/CNPJ *</label>
              <input value={form.cpf_cnpj} onChange={e => set('cpf_cnpj', e.target.value)} placeholder="000.000.000-00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo de pessoa *</label>
              <select value={form.tipo_pessoa} onChange={e => set('tipo_pessoa', e.target.value)} className={inputCls}>
                <option value="">— Selecione —</option>
                <option value="fisica">Física</option>
                <option value="juridica">Jurídica</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>CEP *</label>
              <input value={form.cep} onChange={e => set('cep', e.target.value)} placeholder="00000-000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>UF *</label>
              <input value={form.uf} onChange={e => set('uf', e.target.value.toUpperCase())} placeholder="MG" maxLength={2} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Endereço *</label>
            <input value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua, avenida..." className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Número</label>
              <input value={form.numero} onChange={e => set('numero', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Complemento</label>
              <input value={form.complemento} onChange={e => set('complemento', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Bairro</label>
              <input value={form.bairro} onChange={e => set('bairro', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cidade *</label>
              <input value={form.cidade} onChange={e => set('cidade', e.target.value)} className={inputCls} />
            </div>
          </div>

          {erro && (
            <p className="flex items-start gap-1.5 text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {erro}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#7a8899] hover:bg-[#f9fafb]">
              Cancelar
            </button>
            <button
              onClick={confirmarEEmitir}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#0F3D3E] text-white text-[13px] font-semibold hover:bg-[#145A5B] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Emitindo…' : 'Confirmar e emitir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
