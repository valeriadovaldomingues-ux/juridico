'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { maskCpfCnpj, maskPhone, maskCEP, validateCPF, validateEmail, onlyDigits } from '@/lib/masks'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Cliente } from '@/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
             'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

type FormFields = {
  tipo_pessoa: 'fisica' | 'juridica'
  nome: string
  cpf_cnpj: string
  email: string
  telefone: string
  celular: string
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  observacoes: string
  ativo: boolean
}

type Errors = Partial<Record<keyof FormFields, string>>
type Touched = Partial<Record<keyof FormFields, boolean>>

// ─── Helpers de estilo ────────────────────────────────────────────────────────

function fieldState(field: keyof FormFields, errors: Errors, touched: Touched, value: string) {
  if (!touched[field]) return 'idle'
  if (errors[field]) return 'error'
  if (value) return 'success'
  return 'idle'
}

function inputClass(state: 'idle' | 'error' | 'success', extra = '') {
  const base = `w-full px-3 py-2.5 text-[13px] rounded-xl border outline-none transition-all
    text-[#0f1923] placeholder:text-[#a8b3c4] bg-[#fafbfc] ${extra}`
  if (state === 'error')   return `${base} border-[#e74c3c] focus:border-[#e74c3c] focus:ring-2 focus:ring-[#e74c3c]/10`
  if (state === 'success') return `${base} border-[#2ecc71] focus:border-[#27ae60] focus:ring-2 focus:ring-[#2ecc71]/10`
  return `${base} border-[#E2DDD8] focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10`
}

const labelClass = 'block text-[11px] font-semibold text-[#3d4a5c] mb-1.5 uppercase tracking-wide'

// ─── FieldWrapper (fora do componente pai para evitar remontagem a cada render) ──

function FieldWrapper({
  field, label, required, errors, touched, form, children,
}: {
  field: keyof FormFields
  label: string
  required?: boolean
  errors: Errors
  touched: Touched
  form: FormFields
  children: React.ReactNode
}) {
  const err   = errors[field]
  const state = fieldState(field, errors, touched, String(form[field]))
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="text-[#e74c3c] ml-0.5">*</span>}
      </label>
      <div className="relative">
        {children}
        {state === 'success' && (
          <CheckCircle2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2ecc71] pointer-events-none" />
        )}
        {state === 'error' && (
          <AlertCircle size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#e74c3c] pointer-events-none" />
        )}
      </div>
      {err && touched[field] && (
        <p className="text-[11px] text-[#e74c3c] mt-1 flex items-center gap-1">
          {err}
        </p>
      )}
    </div>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ClienteForm({
  cliente,
  onSuccess,
}: {
  cliente?: Cliente
  onSuccess?: () => void
}) {
  const router = useRouter()
  const isEditing = !!cliente
  const numeroRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormFields>({
    tipo_pessoa:  cliente?.tipo_pessoa  ?? 'fisica',
    nome:         cliente?.nome         ?? '',
    cpf_cnpj:     cliente?.cpf_cnpj     ?? '',
    email:        cliente?.email        ?? '',
    telefone:     cliente?.telefone     ?? '',
    celular:      cliente?.celular      ?? '',
    cep:          cliente?.cep          ?? '',
    endereco:     cliente?.endereco     ?? '',
    numero:       cliente?.numero       ?? '',
    complemento:  cliente?.complemento  ?? '',
    bairro:       cliente?.bairro       ?? '',
    cidade:       cliente?.cidade       ?? '',
    uf:           cliente?.uf           ?? '',
    observacoes:  cliente?.observacoes  ?? '',
    ativo:        cliente?.ativo        ?? true,
  })

  const [errors, setErrors]   = useState<Errors>({})
  const [touched, setTouched] = useState<Touched>({})
  const [loading, setLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Estado dos campos ──────────────────────────────────────────────────────

  function set(field: keyof FormFields, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function touch(field: keyof FormFields) {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  function setError(field: keyof FormFields, msg: string) {
    setErrors(prev => ({ ...prev, [field]: msg }))
  }

  function clearError(field: keyof FormFields) {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  // ── Validações por campo ───────────────────────────────────────────────────

  function validateField(field: keyof FormFields, value: string) {
    switch (field) {
      case 'nome':
        if (!value.trim()) { setError('nome', 'Nome é obrigatório'); return false }
        clearError('nome'); return true

      case 'cpf_cnpj':
        if (form.tipo_pessoa === 'fisica') {
          const digits = onlyDigits(value)
          if (!digits) { setError('cpf_cnpj', 'CPF é obrigatório'); return false }
          if (digits.length < 11) { setError('cpf_cnpj', 'CPF incompleto'); return false }
          if (!validateCPF(value)) { setError('cpf_cnpj', 'CPF inválido'); return false }
        }
        clearError('cpf_cnpj'); return true

      case 'email':
        if (!value.trim()) { setError('email', 'E-mail é obrigatório'); return false }
        if (!validateEmail(value)) { setError('email', 'E-mail inválido'); return false }
        clearError('email'); return true

      case 'celular': {
        const digits = onlyDigits(value)
        if (value && digits.length < 10) { setError('celular', 'Número incompleto'); return false }
        clearError('celular'); return true
      }

      case 'telefone': {
        const digits = onlyDigits(value)
        if (value && digits.length < 10) { setError('telefone', 'Número incompleto'); return false }
        clearError('telefone'); return true
      }

      case 'cep': {
        const digits = onlyDigits(value)
        if (value && digits.length < 8) { setError('cep', 'CEP incompleto'); return false }
        clearError('cep'); return true
      }

      default:
        return true
    }
  }

  function handleBlur(field: keyof FormFields) {
    touch(field)
    validateField(field, String(form[field]))
  }

  // ── Handlers de máscara ────────────────────────────────────────────────────

  function handleCpfCnpj(raw: string) {
    const masked = maskCpfCnpj(raw, form.tipo_pessoa)
    set('cpf_cnpj', masked)
    if (touched.cpf_cnpj) validateField('cpf_cnpj', masked)
  }

  function handlePhone(field: 'celular' | 'telefone', raw: string) {
    const masked = maskPhone(raw)
    set(field, masked)
    if (touched[field]) validateField(field, masked)
  }

  function handleTipoPessoa(value: string) {
    setForm(prev => ({ ...prev, tipo_pessoa: value as 'fisica' | 'juridica', cpf_cnpj: '' }))
    clearError('cpf_cnpj')
    setTouched(prev => ({ ...prev, cpf_cnpj: false }))
  }

  // ── ViaCEP ─────────────────────────────────────────────────────────────────

  const fetchCEP = useCallback(async (cep: string) => {
    const digits = onlyDigits(cep)
    if (digits.length !== 8) return

    setCepLoading(true)
    clearError('cep')

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()

      if (data.erro) {
        setError('cep', 'CEP não encontrado')
        setCepLoading(false)
        return
      }

      setForm(prev => ({
        ...prev,
        endereco:  data.logradouro  ?? prev.endereco,
        bairro:    data.bairro      ?? prev.bairro,
        cidade:    data.localidade  ?? prev.cidade,
        uf:        data.uf          ?? prev.uf,
      }))

      // Move foco para número após preencher endereço
      setTimeout(() => numeroRef.current?.focus(), 50)
    } catch {
      setError('cep', 'Falha ao buscar CEP')
    } finally {
      setCepLoading(false)
    }
  }, [])

  function handleCEP(raw: string) {
    const masked = maskCEP(raw)
    set('cep', masked)
    if (touched.cep) validateField('cep', masked)
    if (onlyDigits(masked).length === 8) fetchCEP(masked)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function validateAll(): boolean {
    const fields: (keyof FormFields)[] = ['nome', 'cpf_cnpj', 'email', 'celular', 'telefone', 'cep']
    const allTouched = fields.reduce((acc, f) => ({ ...acc, [f]: true }), {} as Touched)
    setTouched(prev => ({ ...prev, ...allTouched }))
    return fields.every(f => validateField(f, String(form[f])))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    if (!validateAll()) return

    setLoading(true)
    const supabase = createClient()

    const payload = {
      ...form,
      cpf_cnpj:    form.cpf_cnpj    || null,
      email:       form.email       || null,
      telefone:    form.telefone    || null,
      celular:     form.celular     || null,
      cep:         form.cep         || null,
      endereco:    form.endereco    || null,
      numero:      form.numero      || null,
      complemento: form.complemento || null,
      bairro:      form.bairro      || null,
      cidade:      form.cidade      || null,
      uf:          form.uf          || null,
      observacoes: form.observacoes || null,
    }

    let result
    if (isEditing) {
      result = await supabase.from('clientes').update(payload).eq('id', cliente.id)
    } else {
      result = await supabase.from('clientes').insert(payload).select().single()
    }

    if (result.error) {
      setSubmitError(result.error.message)
      setLoading(false)
      return
    }

    if (onSuccess) {
      onSuccess()
    } else {
      router.push('/clientes')
      router.refresh()
    }
  }

  // ── Estados derivados ──────────────────────────────────────────────────────

  const cpfState     = fieldState('cpf_cnpj', errors, touched, form.cpf_cnpj)
  const emailState   = fieldState('email',    errors, touched, form.email)
  const celularState = fieldState('celular',  errors, touched, form.celular)
  const telState     = fieldState('telefone', errors, touched, form.telefone)
  const cepState     = fieldState('cep',      errors, touched, form.cep)
  const nomeState    = fieldState('nome',     errors, touched, form.nome)

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">

      {/* ── Dados Principais ── */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <h2 className="text-[13px] font-semibold text-[#0f1923] mb-5">Dados Principais</h2>
        <div className="grid grid-cols-3 gap-4">

          {/* Tipo de pessoa */}
          <div>
            <label className={labelClass}>Tipo de Pessoa <span className="text-[#e74c3c]">*</span></label>
            <select
              value={form.tipo_pessoa}
              onChange={e => handleTipoPessoa(e.target.value)}
              className={inputClass('idle')}
            >
              <option value="fisica">Pessoa Física</option>
              <option value="juridica">Pessoa Jurídica</option>
            </select>
          </div>

          {/* Nome */}
          <div className="col-span-2">
            <FieldWrapper field="nome" label="Nome / Razão Social" required errors={errors} touched={touched} form={form}>
              <input
                required
                value={form.nome}
                onChange={e => { set('nome', e.target.value); if (touched.nome) validateField('nome', e.target.value) }}
                onBlur={() => handleBlur('nome')}
                className={inputClass(nomeState, 'pr-8')}
                placeholder="Nome completo ou razão social"
              />
            </FieldWrapper>
          </div>

          {/* CPF / CNPJ */}
          <div>
            <FieldWrapper
              field="cpf_cnpj"
              label={form.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'}
              required={form.tipo_pessoa === 'fisica'}
              errors={errors} touched={touched} form={form}
            >
              <input
                value={form.cpf_cnpj}
                onChange={e => handleCpfCnpj(e.target.value)}
                onBlur={() => handleBlur('cpf_cnpj')}
                placeholder={form.tipo_pessoa === 'juridica' ? '00.000.000/0000-00' : '000.000.000-00'}
                inputMode="numeric"
                className={inputClass(cpfState, 'font-mono pr-8')}
              />
            </FieldWrapper>
          </div>

          {/* E-mail */}
          <div>
            <FieldWrapper field="email" label="E-mail" required errors={errors} touched={touched} form={form}>
              <input
                type="email"
                value={form.email}
                onChange={e => { set('email', e.target.value); if (touched.email) validateField('email', e.target.value) }}
                onBlur={() => handleBlur('email')}
                placeholder="email@exemplo.com"
                className={inputClass(emailState, 'pr-8')}
              />
            </FieldWrapper>
          </div>

          {/* Celular */}
          <div>
            <FieldWrapper field="celular" label="Celular" errors={errors} touched={touched} form={form}>
              <input
                value={form.celular}
                onChange={e => handlePhone('celular', e.target.value)}
                onBlur={() => handleBlur('celular')}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                className={inputClass(celularState, 'font-mono pr-8')}
              />
            </FieldWrapper>
          </div>

          {/* Telefone */}
          <div>
            <FieldWrapper field="telefone" label="Telefone" errors={errors} touched={touched} form={form}>
              <input
                value={form.telefone}
                onChange={e => handlePhone('telefone', e.target.value)}
                onBlur={() => handleBlur('telefone')}
                placeholder="(00) 0000-0000"
                inputMode="numeric"
                className={inputClass(telState, 'font-mono pr-8')}
              />
            </FieldWrapper>
          </div>

        </div>
      </div>

      {/* ── Endereço ── */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <h2 className="text-[13px] font-semibold text-[#0f1923] mb-5">Endereço</h2>
        <div className="grid grid-cols-4 gap-4">

          {/* CEP com busca automática */}
          <div>
            <label className={labelClass}>CEP</label>
            <div className="relative">
              <input
                value={form.cep}
                onChange={e => handleCEP(e.target.value)}
                onBlur={() => handleBlur('cep')}
                placeholder="00000-000"
                inputMode="numeric"
                className={inputClass(cepState, 'font-mono pr-8')}
              />
              {cepLoading
                ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a8899] animate-spin pointer-events-none" />
                : cepState === 'success'
                  ? <CheckCircle2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2ecc71] pointer-events-none" />
                  : cepState === 'error'
                    ? <AlertCircle size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#e74c3c] pointer-events-none" />
                    : null
              }
            </div>
            {errors.cep && touched.cep && (
              <p className="text-[11px] text-[#e74c3c] mt-1">{errors.cep}</p>
            )}
            {cepLoading && (
              <p className="text-[11px] text-[#7a8899] mt-1">Buscando endereço...</p>
            )}
          </div>

          {/* Logradouro */}
          <div className="col-span-2">
            <label className={labelClass}>Logradouro</label>
            <input
              value={form.endereco}
              onChange={e => set('endereco', e.target.value)}
              className={inputClass('idle')}
              placeholder="Rua, Avenida, Travessa..."
            />
          </div>

          {/* Número */}
          <div>
            <label className={labelClass}>Número</label>
            <input
              ref={numeroRef}
              value={form.numero}
              onChange={e => set('numero', e.target.value)}
              className={inputClass('idle')}
              placeholder="Nº"
            />
          </div>

          {/* Complemento */}
          <div>
            <label className={labelClass}>Complemento</label>
            <input
              value={form.complemento}
              onChange={e => set('complemento', e.target.value)}
              placeholder="Apto, sala, bloco..."
              className={inputClass('idle')}
            />
          </div>

          {/* Bairro */}
          <div>
            <label className={labelClass}>Bairro</label>
            <input
              value={form.bairro}
              onChange={e => set('bairro', e.target.value)}
              className={inputClass('idle')}
            />
          </div>

          {/* Cidade */}
          <div>
            <label className={labelClass}>Cidade</label>
            <input
              value={form.cidade}
              onChange={e => set('cidade', e.target.value)}
              className={inputClass('idle')}
            />
          </div>

          {/* UF */}
          <div>
            <label className={labelClass}>UF</label>
            <select
              value={form.uf}
              onChange={e => set('uf', e.target.value)}
              className={inputClass('idle')}
            >
              <option value="">—</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

        </div>
      </div>

      {/* ── Outras Informações ── */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <h2 className="text-[13px] font-semibold text-[#0f1923] mb-5">Outras Informações</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={3}
              className={`${inputClass('idle')} resize-none`}
            />
          </div>
          <div className="flex items-start pt-7">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={e => set('ativo', e.target.checked)}
                className="w-4 h-4 rounded accent-[#0F3D3E]"
              />
              <span className="text-[13px] font-medium text-[#3d4a5c]">Cliente ativo</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Erro de submit ── */}
      {submitError && (
        <div className="flex items-center gap-2 text-[13px] text-[#a93226] bg-[#fde8e8] border border-[#f5c6c6] px-4 py-3 rounded-xl">
          <AlertCircle size={14} className="flex-shrink-0" />
          {submitError}
        </div>
      )}

      {/* ── Ações ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSuccess ? onSuccess() : router.push('/clientes')}
          className="px-5 py-2.5 text-[13px] font-medium text-[#7a8899] hover:text-[#0f1923] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </button>
      </div>
    </form>
  )
}
