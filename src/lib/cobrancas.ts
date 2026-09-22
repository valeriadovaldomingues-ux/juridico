import type { SupabaseClient } from '@supabase/supabase-js'
import type { CobrancaInput } from '../types/cobrancas'

// A API de cobranças do Inter (boleto/Pix) exige o endereço completo do
// pagador (cep, endereco, cidade, uf, tipoPessoa) — sem isso, a emissão
// falha com "Dados inválidos". Esses campos já existem em `clientes`,
// só precisavam ser selecionados aqui pra chegar até createInterCharge.
export const COBRANCAS_SELECT = `
  *,
  cliente:clientes(id, nome, cpf_cnpj, email, tipo_pessoa, cep, endereco, numero, complemento, bairro, cidade, uf),
  processo:processos(id, numero_processo, titulo)
`

export function statusForDueDate(status: string, dataVencimento: string) {
  if (!['rascunho', 'pendente', 'emitida'].includes(status)) return status
  const today = new Date().toISOString().slice(0, 10)
  return dataVencimento < today ? 'vencida' : status
}

export function normalizeCobrancaInput(body: Partial<CobrancaInput>) {
  const valor = Number(body.valor)
  const parcelaNumero = Number(body.parcela_numero ?? 1)
  const parcelaTotal = Number(body.parcela_total ?? 1)

  if (!body.cliente_id) throw new Error('Cliente obrigatorio.')
  // R$2,50 é o mínimo aceito pela API de boleto/Pix do Inter — abaixo
  // disso a emissão falha lá na frente com um erro bem menos claro.
  if (!Number.isFinite(valor) || valor < 2.5) throw new Error('Valor deve ser de pelo menos R$ 2,50.')
  if (!body.data_vencimento) throw new Error('Data de vencimento obrigatoria.')
  if (!body.descricao?.trim()) throw new Error('Descricao obrigatoria.')
  if (parcelaNumero < 1 || parcelaTotal < 1 || parcelaNumero > parcelaTotal) {
    throw new Error('Parcelamento invalido.')
  }

  return {
    cliente_id: body.cliente_id,
    contrato_id: body.contrato_id || null,
    processo_id: body.processo_id || null,
    valor,
    data_vencimento: body.data_vencimento,
    descricao: body.descricao.trim(),
    parcela_numero: parcelaNumero,
    parcela_total: parcelaTotal,
  }
}

export async function logCobranca(
  supabase: SupabaseClient,
  input: {
    cobranca_id?: string | null
    acao: string
    detalhe?: string | null
    payload?: unknown
    usuario_id?: string | null
    ip?: string | null
    user_agent?: string | null
  },
) {
  await supabase.from('cobranca_logs').insert({
    cobranca_id: input.cobranca_id ?? null,
    acao: input.acao,
    detalhe: input.detalhe ?? null,
    payload: input.payload ?? null,
    usuario_id: input.usuario_id ?? null,
    ip: input.ip ?? null,
    user_agent: input.user_agent ?? null,
  })
}

export async function addCobrancaEvento(
  supabase: SupabaseClient,
  input: {
    cobranca_id: string
    tipo: string
    status_anterior?: string | null
    status_novo?: string | null
    payload?: unknown
    created_by?: string | null
  },
) {
  await supabase.from('cobranca_eventos').insert({
    cobranca_id: input.cobranca_id,
    tipo: input.tipo,
    status_anterior: input.status_anterior ?? null,
    status_novo: input.status_novo ?? null,
    payload: input.payload ?? null,
    created_by: input.created_by ?? null,
  })
}

export async function assertProcessoBelongsToCliente(
  supabase: SupabaseClient,
  clienteId: string,
  processoId?: string | null,
) {
  if (!processoId) return

  const { data, error } = await supabase
    .from('processos')
    .select('id, cliente_id')
    .eq('id', processoId)
    .single()

  if (error || !data) throw new Error('Processo vinculado nao encontrado.')
  if (data.cliente_id && data.cliente_id !== clienteId) {
    throw new Error('Processo vinculado nao pertence ao cliente informado.')
  }
}

export function addMonthsKeepingDay(start: string, monthOffset: number, dayOfMonth: number) {
  const base = new Date(`${start}T12:00:00`)
  const target = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1, 12)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(dayOfMonth, lastDay))
  return target.toISOString().slice(0, 10)
}
