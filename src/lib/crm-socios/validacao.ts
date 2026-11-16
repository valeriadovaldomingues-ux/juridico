// ─────────────────────────────────────────────────────────────────────────────
// CRM Cris e Val — validação/normalização dos corpos das API routes.
// Funções puras: recebem `unknown`, devolvem só campos conhecidos e já limpos.
// ─────────────────────────────────────────────────────────────────────────────

import {
  STATUS_PROPOSTA,
  TIPOS_HONORARIO,
  TIPOS_INTERACAO,
  TIPOS_PESSOA,
  type StatusProposta,
  type TipoHonorario,
  type TipoInteracao,
  type TipoPessoa,
} from './constants'
import { lerValorBR } from './formato'
import { ehDataISO, ehEtapaValida } from './regras'
import type { EtapaId } from './constants'

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ehUUID = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

type Corpo = Record<string, unknown>

function comoObjeto(body: unknown): Corpo | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Corpo) : null
}

/** Texto opcional: string aparada, vazia vira null. `undefined` = campo ausente. */
function texto(v: unknown, max: number): string | null | undefined | { erro: string } {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') return { erro: 'valor de texto inválido' }
  const t = v.trim()
  if (t.length > max) return { erro: `texto longo demais (máx. ${max} caracteres)` }
  return t === '' ? null : t
}

function dinheiro(v: unknown): number | null | undefined | { erro: string } {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = lerValorBR(typeof v === 'number' || typeof v === 'string' ? v : Number.NaN)
  if (n === null || !Number.isFinite(n) || n < 0) return { erro: 'valor inválido' }
  if (n > 9_999_999_999) return { erro: 'valor alto demais' }
  return Math.round(n * 100) / 100
}

const temErro = (x: unknown): x is { erro: string } => !!x && typeof x === 'object' && 'erro' in (x as object)

// ─── Oportunidade ────────────────────────────────────────────────────────────

export interface DadosOportunidade {
  nome?: string
  tipo_pessoa?: TipoPessoa
  contato_nome?: string | null
  contato_telefone?: string | null
  contato_email?: string | null
  origem?: string | null
  indicado_por?: string | null
  area_interesse?: string | null
  valor_estimado?: number | null
  responsavel_id?: string | null
  etapa?: EtapaId
  proxima_acao?: string | null
  proxima_acao_data?: string | null
  motivo_perda?: string | null
  notas?: string | null
  cliente_id?: string | null
}

const CAMPOS_TEXTO_OPORTUNIDADE: Array<[keyof DadosOportunidade, number, string]> = [
  ['contato_nome', 200, 'Nome do contato'],
  ['contato_telefone', 60, 'Telefone'],
  ['contato_email', 200, 'E-mail'],
  ['origem', 200, 'Origem'],
  ['indicado_por', 200, 'Indicado por'],
  ['area_interesse', 200, 'Área de interesse'],
  ['proxima_acao', 500, 'Próxima ação'],
  ['motivo_perda', 1000, 'Motivo da perda'],
  ['notas', 10_000, 'Notas'],
]

/**
 * `modo: 'criar'` exige nome; `modo: 'editar'` aceita qualquer subconjunto (PATCH).
 * Status NÃO é aceito aqui: ele é sempre derivado da etapa (ver regras.validarMovimento).
 */
export function lerOportunidade(body: unknown, modo: 'criar' | 'editar'): Resultado<DadosOportunidade> {
  const b = comoObjeto(body)
  if (!b) return { ok: false, erro: 'Corpo da requisição inválido.' }
  const dados: DadosOportunidade = {}

  if (b.nome !== undefined || modo === 'criar') {
    const nome = typeof b.nome === 'string' ? b.nome.trim() : ''
    if (!nome) return { ok: false, erro: 'Informe o nome da pessoa ou empresa.' }
    if (nome.length > 200) return { ok: false, erro: 'Nome longo demais (máx. 200 caracteres).' }
    dados.nome = nome
  }

  if (b.tipo_pessoa !== undefined) {
    if (!(TIPOS_PESSOA as readonly unknown[]).includes(b.tipo_pessoa)) return { ok: false, erro: 'Tipo de pessoa inválido.' }
    dados.tipo_pessoa = b.tipo_pessoa as TipoPessoa
  }

  for (const [campo, max, rotulo] of CAMPOS_TEXTO_OPORTUNIDADE) {
    const r = texto(b[campo], max)
    if (temErro(r)) return { ok: false, erro: `${rotulo}: ${r.erro}.` }
    if (r !== undefined) (dados as Record<string, unknown>)[campo] = r
  }

  const valor = dinheiro(b.valor_estimado)
  if (temErro(valor)) return { ok: false, erro: `Valor estimado: ${valor.erro}.` }
  if (valor !== undefined) dados.valor_estimado = valor

  if (b.responsavel_id !== undefined) {
    if (b.responsavel_id !== null && b.responsavel_id !== '' && !ehUUID(b.responsavel_id)) return { ok: false, erro: 'Responsável inválido.' }
    dados.responsavel_id = b.responsavel_id ? (b.responsavel_id as string) : null
  }

  if (b.cliente_id !== undefined) {
    if (b.cliente_id !== null && b.cliente_id !== '' && !ehUUID(b.cliente_id)) return { ok: false, erro: 'Cliente inválido.' }
    dados.cliente_id = b.cliente_id ? (b.cliente_id as string) : null
  }

  if (b.proxima_acao_data !== undefined) {
    if (b.proxima_acao_data === null || b.proxima_acao_data === '') dados.proxima_acao_data = null
    else if (ehDataISO(b.proxima_acao_data)) dados.proxima_acao_data = b.proxima_acao_data
    else return { ok: false, erro: 'Data da próxima ação inválida.' }
  }

  if (b.etapa !== undefined) {
    if (!ehEtapaValida(b.etapa)) return { ok: false, erro: 'Etapa inválida.' }
    dados.etapa = b.etapa
  }

  return { ok: true, dados }
}

// ─── Interação ───────────────────────────────────────────────────────────────

export interface DadosInteracao {
  tipo: TipoInteracao
  descricao: string
  data_interacao: string // ISO
}

export function lerInteracao(body: unknown, agora: Date = new Date()): Resultado<DadosInteracao> {
  const b = comoObjeto(body)
  if (!b) return { ok: false, erro: 'Corpo da requisição inválido.' }
  if (!(TIPOS_INTERACAO as readonly unknown[]).includes(b.tipo)) return { ok: false, erro: 'Tipo de interação inválido.' }
  const descricao = typeof b.descricao === 'string' ? b.descricao.trim() : ''
  if (!descricao) return { ok: false, erro: 'Descreva a interação.' }
  if (descricao.length > 10_000) return { ok: false, erro: 'Descrição longa demais.' }

  let data = agora.toISOString()
  if (b.data_interacao !== undefined && b.data_interacao !== null && b.data_interacao !== '') {
    if (typeof b.data_interacao !== 'string') return { ok: false, erro: 'Data da interação inválida.' }
    // Aceita "yyyy-mm-dd" (vira meio-dia local para não escorregar de dia) ou timestamp ISO.
    const bruto = ehDataISO(b.data_interacao) ? `${b.data_interacao}T12:00:00` : b.data_interacao
    const d = new Date(bruto)
    if (Number.isNaN(d.getTime())) return { ok: false, erro: 'Data da interação inválida.' }
    data = d.toISOString()
  }
  return { ok: true, dados: { tipo: b.tipo as TipoInteracao, descricao, data_interacao: data } }
}

// ─── Proposta ────────────────────────────────────────────────────────────────

export interface DadosProposta {
  oportunidade_id?: string
  titulo?: string
  descricao?: string | null
  valor?: number | null
  tipo_honorario?: TipoHonorario
  forma_pagamento?: string | null
  data_envio?: string | null
  validade?: string | null
  status?: StatusProposta
  observacoes?: string | null
}

export function lerProposta(body: unknown, modo: 'criar' | 'editar'): Resultado<DadosProposta> {
  const b = comoObjeto(body)
  if (!b) return { ok: false, erro: 'Corpo da requisição inválido.' }
  const dados: DadosProposta = {}

  if (modo === 'criar') {
    if (!ehUUID(b.oportunidade_id)) return { ok: false, erro: 'Oportunidade inválida.' }
    dados.oportunidade_id = b.oportunidade_id
  }

  if (b.titulo !== undefined || modo === 'criar') {
    const titulo = typeof b.titulo === 'string' ? b.titulo.trim() : ''
    if (!titulo) return { ok: false, erro: 'Dê um título à proposta.' }
    if (titulo.length > 200) return { ok: false, erro: 'Título longo demais (máx. 200 caracteres).' }
    dados.titulo = titulo
  }

  for (const [campo, max, rotulo] of [
    ['descricao', 10_000, 'Descrição'],
    ['forma_pagamento', 500, 'Forma de pagamento'],
    ['observacoes', 10_000, 'Observações'],
  ] as const) {
    const r = texto(b[campo], max)
    if (temErro(r)) return { ok: false, erro: `${rotulo}: ${r.erro}.` }
    if (r !== undefined) dados[campo] = r
  }

  const valor = dinheiro(b.valor)
  if (temErro(valor)) return { ok: false, erro: `Valor: ${valor.erro}.` }
  if (valor !== undefined) dados.valor = valor

  if (b.tipo_honorario !== undefined) {
    if (!(TIPOS_HONORARIO as readonly unknown[]).includes(b.tipo_honorario)) return { ok: false, erro: 'Tipo de honorário inválido.' }
    dados.tipo_honorario = b.tipo_honorario as TipoHonorario
  }

  if (b.status !== undefined) {
    if (!(STATUS_PROPOSTA as readonly unknown[]).includes(b.status)) return { ok: false, erro: 'Status da proposta inválido.' }
    dados.status = b.status as StatusProposta
  }

  for (const campo of ['data_envio', 'validade'] as const) {
    const v = b[campo]
    if (v === undefined) continue
    if (v === null || v === '') dados[campo] = null
    else if (ehDataISO(v)) dados[campo] = v
    else return { ok: false, erro: campo === 'data_envio' ? 'Data de envio inválida.' : 'Validade inválida.' }
  }

  if (dados.data_envio && dados.validade && dados.validade < dados.data_envio) {
    return { ok: false, erro: 'A validade não pode ser anterior à data de envio.' }
  }

  return { ok: true, dados }
}
