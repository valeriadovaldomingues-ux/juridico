import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import type { UserRole } from '../types'
import type { Cobranca, CobrancaDuplicateKey, CobrancaInsertRow, CobrancaUpdateRow } from '../types/cobrancas'
import { addMonthsKeepingDay, normalizeCobrancaInput, statusForDueDate } from './cobrancas'
import { handleInterWebhook, mapInterStatusToInternal, normalizeInterChargeResponse, sanitizeInterError, type NormalizedInterChargeResponse } from './interClient'
import type { CobrancasStore } from './cobrancas-store'

export const COBRANCAS_ALLOWED_ROLES = ['administrativo', 'gerente', 'socio'] as const
export const WEBHOOK_MAX_BYTES = 256 * 1024
const INTER_SYNC_RETRYABLE_STATUS_CODES = new Set([404, 409, 425, 429, 503])
const DEFAULT_INTER_SYNC_ATTEMPTS = 1
const DEFAULT_INTER_SYNC_RETRY_DELAY_MS = 350
const DEFAULT_INTER_EMISSION_ATTEMPTS = 3

export interface InterGateway {
  createInterCharge(input: {
    id: string
    idempotencyKey: string
    valor: number
    data_vencimento: string
    descricao: string
    cliente?: { nome?: string | null; cpf_cnpj?: string | null; email?: string | null } | null
  }): Promise<Record<string, unknown>>
  getInterCharge(interCobrancaId: string): Promise<Record<string, unknown>>
}

export type ActionResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string }

export interface WebhookHeadersLike {
  get(name: string): string | null
}

function ok<T>(status: number, data: T): ActionResult<T> {
  return { ok: true, status, data }
}

function fail(error: string, status = 400): ActionResult<never> {
  return { ok: false, status, error }
}

function canAccess(role: UserRole) {
  return COBRANCAS_ALLOWED_ROLES.includes(role as (typeof COBRANCAS_ALLOWED_ROLES)[number])
}

function duplicateKeyFor(input: Pick<CobrancaDuplicateKey, 'cliente_id' | 'processo_id' | 'valor' | 'data_vencimento' | 'parcela_numero' | 'parcela_total'>) {
  return [
    input.cliente_id,
    input.processo_id ?? 'null',
    input.valor.toFixed(2),
    input.data_vencimento,
    String(input.parcela_numero),
    String(input.parcela_total),
  ].join('|')
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseInterApiStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/^Inter API (\d+):/i)
  return match ? Number(match[1]) : null
}

function isRetryableInterError(error: unknown) {
  const status = parseInterApiStatus(error)
  return status !== null && INTER_SYNC_RETRYABLE_STATUS_CODES.has(status)
}

function resolveSyncedStatus(currentStatus: Cobranca['status'], receivedStatus: Cobranca['status'], dataVencimento: string) {
  if (currentStatus === 'paga') return 'paga'
  if (currentStatus === 'cancelada' && receivedStatus !== 'paga') return 'cancelada'
  if (receivedStatus === 'paga') return 'paga'
  if (receivedStatus === 'cancelada') return 'cancelada'
  if (receivedStatus === 'processando') return currentStatus === 'cancelada' ? 'cancelada' : 'processando'
  return statusForDueDate(receivedStatus, dataVencimento) as Cobranca['status']
}

function buildSyncedPatch(
  cobranca: Cobranca,
  normalized: NormalizedInterChargeResponse | null,
  payload: Record<string, unknown> | null,
  ready: boolean,
): CobrancaUpdateRow {
  const interStatus = normalized?.inter_status ?? cobranca.inter_status
  const receivedStatus = mapInterStatusToInternal(interStatus)
  const status = ready
    ? resolveSyncedStatus(cobranca.status, receivedStatus, cobranca.data_vencimento)
    : (
      cobranca.status === 'paga'
        ? 'paga'
        : cobranca.status === 'cancelada'
          ? 'cancelada'
          : ['rascunho', 'pendente', 'erro_emissao', 'processando'].includes(cobranca.status)
            ? 'processando'
            : cobranca.status
    )

  const patch: CobrancaUpdateRow = {
    status,
    inter_status: interStatus,
    payload_ultimo_status: payload ?? cobranca.payload_ultimo_status,
    erro_emissao: null,
  }

  if (normalized?.inter_cobranca_id && !cobranca.inter_cobranca_id) {
    patch.inter_cobranca_id = normalized.inter_cobranca_id
  }

  if (ready && normalized) {
    patch.nosso_numero = normalized.nosso_numero ?? cobranca.nosso_numero
    patch.linha_digitavel = normalized.linha_digitavel ?? cobranca.linha_digitavel
    patch.codigo_barras = normalized.codigo_barras ?? cobranca.codigo_barras
    patch.pix_qrcode = normalized.pix_qrcode ?? cobranca.pix_qrcode
    patch.pix_copia_cola = normalized.pix_copia_cola ?? cobranca.pix_copia_cola
    patch.boleto_pdf_url = normalized.boleto_pdf_url ?? cobranca.boleto_pdf_url
    patch.data_pagamento = normalized.paidAt ?? (status === 'paga' ? cobranca.data_pagamento ?? new Date().toISOString() : cobranca.data_pagamento)
    patch.valor_pago = normalized.paidValue ?? (status === 'paga' ? cobranca.valor_pago ?? Number(cobranca.valor) : cobranca.valor_pago)
  } else if (receivedStatus === 'processando' && ['emitida', 'erro_emissao', 'pendente', 'rascunho'].includes(cobranca.status)) {
    patch.status = 'processando'
  }

  return patch
}

async function fetchInterChargeSnapshot(input: {
  inter: Pick<InterGateway, 'getInterCharge'>
  interCobrancaId: string
  attempts?: number
  retryDelayMs?: number
}): Promise<{
  ready: boolean
  payload: Record<string, unknown> | null
  normalized: NormalizedInterChargeResponse | null
}> {
  const attempts = Math.max(1, Math.trunc(input.attempts ?? DEFAULT_INTER_SYNC_ATTEMPTS))
  const retryDelayMs = Math.max(0, Math.trunc(input.retryDelayMs ?? DEFAULT_INTER_SYNC_RETRY_DELAY_MS))
  let lastPayload: Record<string, unknown> | null = null
  let lastNormalized: NormalizedInterChargeResponse | null = null

  for (let index = 0; index < attempts; index += 1) {
    try {
      const payload = await input.inter.getInterCharge(input.interCobrancaId)
      const normalized = normalizeInterChargeResponse(payload)
      const receivedStatus = mapInterStatusToInternal(normalized.inter_status)
      lastPayload = payload
      lastNormalized = normalized

      if (receivedStatus !== 'processando') {
        return { ready: true, payload, normalized }
      }
    } catch (error) {
      if (!isRetryableInterError(error)) {
        throw error
      }
    }

    if (index < attempts - 1) {
      await delay(retryDelayMs * (index + 1))
    }
  }

  return { ready: false, payload: lastPayload, normalized: lastNormalized }
}

function parseDateMonth(month: string) {
  const [year, mm] = month.split('-').map(Number)
  return new Date(year, mm, 1)
}

async function validateProcessLink(store: CobrancasStore, clienteId: string, processoId: string | null) {
  if (!processoId) return null
  const processo = await store.findProcessoById(processoId)
  if (!processo) return 'Processo vinculado nao encontrado.'
  if (processo.cliente_id !== clienteId) return 'Processo vinculado nao pertence ao cliente informado.'
  return null
}

function buildInsertRow(base: {
  cliente_id: string
  contrato_id: string | null
  processo_id: string | null
  valor: number
  data_vencimento: string
  descricao: string
  parcela_numero: number
  parcela_total: number
  created_by: string
  status: CobrancaInsertRow['status']
}): CobrancaInsertRow {
  return {
    cliente_id: base.cliente_id,
    contrato_id: base.contrato_id,
    processo_id: base.processo_id,
    valor: base.valor,
    data_vencimento: base.data_vencimento,
    descricao: base.descricao,
    parcela_numero: base.parcela_numero,
    parcela_total: base.parcela_total,
    status: base.status,
    inter_status: null,
    inter_cobranca_id: null,
    nosso_numero: null,
    linha_digitavel: null,
    codigo_barras: null,
    pix_qrcode: null,
    pix_copia_cola: null,
    boleto_pdf_url: null,
    data_pagamento: null,
    valor_pago: null,
    payload_criacao: null,
    payload_ultimo_status: null,
    erro_emissao: null,
    idempotency_key: randomUUID(),
    created_by: base.created_by,
  }
}

export async function createSingleCobrancaAction(input: {
  role: UserRole
  userId: string
  store: CobrancasStore
  body: Partial<Parameters<typeof normalizeCobrancaInput>[0]>
}): Promise<ActionResult<Cobranca>> {
  if (!canAccess(input.role)) return fail('Sem permissao para esta operacao.', 403)

  let normalized
  try {
    normalized = normalizeCobrancaInput(input.body)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Dados invalidos.', 400)
  }

  const relationError = await validateProcessLink(input.store, normalized.cliente_id, normalized.processo_id)
  if (relationError) return fail(relationError, 400)

  const duplicate = await input.store.findDuplicateCharge({
    cliente_id: normalized.cliente_id,
    processo_id: normalized.processo_id,
    valor: normalized.valor,
    data_vencimento: normalized.data_vencimento,
    parcela_numero: normalized.parcela_numero,
    parcela_total: normalized.parcela_total,
  })

  if (duplicate) return fail('Ja existe uma cobranca para esta parcela.', 409)

  const created = await input.store.createCharge(
    buildInsertRow({
      ...normalized,
      status: statusForDueDate('pendente', normalized.data_vencimento) as CobrancaInsertRow['status'],
      created_by: input.userId,
    }),
  )

  await input.store.insertEvent({
    cobranca_id: created.id,
    tipo: 'criacao_manual',
    status_novo: created.status,
    payload: normalized,
    created_by: input.userId,
  })
  await input.store.insertLog({
    cobranca_id: created.id,
    acao: 'criacao_cobranca',
    payload: normalized,
    usuario_id: input.userId,
  })

  return ok(201, created)
}

export async function createRecurringCobrancasAction(input: {
  role: UserRole
  userId: string
  store: CobrancasStore
  body: {
    cliente_id?: string
    contrato_id?: string | null
    processo_id?: string | null
    valor?: number | string
    data_vencimento_inicial?: string
    quantidade_parcelas?: number | string
    dia_vencimento?: number | string
    descricao?: string
  }
}): Promise<ActionResult<Cobranca[]>> {
  if (!canAccess(input.role)) return fail('Sem permissao para esta operacao.', 403)

  const clienteId = input.body.cliente_id?.trim()
  const descricao = input.body.descricao?.trim()
  const vencimentoInicial = input.body.data_vencimento_inicial
  const valor = Number(input.body.valor)
  const quantidade = Number(input.body.quantidade_parcelas)
  const diaVencimento = Number(input.body.dia_vencimento)
  const processoId = input.body.processo_id?.trim() || null
  const contratoId = input.body.contrato_id?.trim() || null

  if (!clienteId || !descricao || !vencimentoInicial) {
    return fail('Cliente, vencimento inicial e descricao sao obrigatorios.', 400)
  }
  if (!Number.isFinite(valor) || valor <= 0 || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 120 || !Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
    return fail('Valor, parcelas ou dia de vencimento invalidos.', 400)
  }

  const relationError = await validateProcessLink(input.store, clienteId, processoId)
  if (relationError) return fail(relationError, 400)

  const seen = new Set<string>()
  const rows: CobrancaInsertRow[] = []

  for (let index = 0; index < quantidade; index += 1) {
    const dataVencimento = addMonthsKeepingDay(vencimentoInicial, index, diaVencimento)
    const baseKey: CobrancaDuplicateKey = {
      cliente_id: clienteId,
      processo_id: processoId,
      valor,
      data_vencimento: dataVencimento,
      parcela_numero: index + 1,
      parcela_total: quantidade,
    }
    const keyStr = duplicateKeyFor(baseKey)

    if (seen.has(keyStr)) return fail('Parcelas duplicadas na geracao recorrente.', 409)
    seen.add(keyStr)

    const duplicate = await input.store.findDuplicateCharge(baseKey)
    if (duplicate) return fail(`Ja existe cobranca para a parcela ${index + 1}.`, 409)

    rows.push(buildInsertRow({
      cliente_id: clienteId,
      contrato_id: contratoId,
      processo_id: processoId,
      valor,
      data_vencimento: dataVencimento,
      descricao,
      parcela_numero: index + 1,
      parcela_total: quantidade,
      created_by: input.userId,
      status: statusForDueDate('pendente', dataVencimento) as CobrancaInsertRow['status'],
    }))
  }

  const created = await input.store.createCharges(rows)

  await Promise.all(created.map(cobranca => input.store.insertEvent({
    cobranca_id: cobranca.id,
    tipo: 'criacao_recorrente',
    status_novo: cobranca.status,
    payload: {
      parcela_numero: cobranca.parcela_numero,
      parcela_total: cobranca.parcela_total,
    },
    created_by: input.userId,
  })))

  await input.store.insertLog({
    acao: 'criacao_recorrente',
    detalhe: `${created.length} cobrancas criadas`,
    payload: {
      cliente_id: clienteId,
      contrato_id: contratoId,
      processo_id: processoId,
      valor,
      data_vencimento_inicial: vencimentoInicial,
      quantidade_parcelas: quantidade,
      dia_vencimento: diaVencimento,
      descricao,
    },
    usuario_id: input.userId,
  })

  return ok(201, created)
}

export async function emitInterCobrancaAction(input: {
  role: UserRole
  userId: string | null
  store: CobrancasStore
  inter: InterGateway
  id: string
}): Promise<ActionResult<Cobranca>> {
  if (!canAccess(input.role)) return fail('Sem permissao para esta operacao.', 403)

  const cobranca = await input.store.findCobrancaById(input.id)
  if (!cobranca) return fail('Cobranca nao encontrada.', 404)
  if (cobranca.status === 'paga') return fail('Cobranca ja paga.', 409)
  if (cobranca.inter_cobranca_id && cobranca.status !== 'erro_emissao') {
    return fail('Cobranca ja emitida no Inter.', 409)
  }

  try {
    const payload = await input.inter.createInterCharge({
      id: cobranca.id,
      idempotencyKey: cobranca.idempotency_key,
      valor: Number(cobranca.valor),
      data_vencimento: cobranca.data_vencimento,
      descricao: cobranca.descricao,
      cliente: cobranca.cliente ?? null,
    })

    const normalized = normalizeInterChargeResponse(payload)
    const updated = await input.store.updateCharge(cobranca.id, {
      status: 'processando',
      inter_status: normalized.inter_status ?? 'processando',
      inter_cobranca_id: normalized.inter_cobranca_id || cobranca.inter_cobranca_id,
      payload_criacao: payload,
      payload_ultimo_status: payload,
      erro_emissao: null,
    })

    if (!updated) return fail('Falha ao atualizar cobranca apos emissao.', 500)

    await input.store.insertEvent({
      cobranca_id: cobranca.id,
      tipo: 'emissao_inter',
      status_anterior: cobranca.status,
      status_novo: updated.status,
      payload,
      created_by: input.userId,
    })
    await input.store.insertLog({
      cobranca_id: cobranca.id,
      acao: 'emissao_inter',
      payload,
      usuario_id: input.userId,
    })

    const syncResult = await syncInterCobrancaAction({
      role: input.role,
      userId: input.userId,
      store: input.store,
      inter: input.inter,
      id: cobranca.id,
      attempts: DEFAULT_INTER_EMISSION_ATTEMPTS,
      retryDelayMs: 250,
      auditAction: 'sincronizacao_pos_emissao',
      eventType: 'sincronizacao_pos_emissao',
    })

    if (!syncResult.ok) return syncResult
    return ok(syncResult.status, syncResult.data)
  } catch (error) {
    const message = error instanceof Error ? sanitizeInterError(error.message) : 'Falha desconhecida ao emitir no Inter.'
    const updated = await input.store.updateCharge(cobranca.id, {
      status: 'erro_emissao',
      erro_emissao: message,
    })
    if (!updated) return fail(message, 502)

    await input.store.insertLog({
      cobranca_id: cobranca.id,
      acao: 'erro_emissao_inter',
      detalhe: message,
      usuario_id: input.userId,
    })
    return fail(message, 502)
  }
}

export async function syncInterCobrancaAction(input: {
  role: UserRole
  userId: string | null
  store: CobrancasStore
  inter: Pick<InterGateway, 'getInterCharge'>
  id: string
  attempts?: number
  retryDelayMs?: number
  auditAction?: string
  eventType?: string
}): Promise<ActionResult<Cobranca>> {
  if (!canAccess(input.role)) return fail('Sem permissao para esta operacao.', 403)

  const cobranca = await input.store.findCobrancaById(input.id)
  if (!cobranca) return fail('Cobranca nao encontrada.', 404)
  if (!cobranca.inter_cobranca_id) return fail('Cobranca ainda nao possui identificador do Inter.', 409)

  try {
    const snapshot = await fetchInterChargeSnapshot({
      inter: input.inter,
      interCobrancaId: cobranca.inter_cobranca_id,
      attempts: input.attempts,
      retryDelayMs: input.retryDelayMs,
    })

    const patch = buildSyncedPatch(cobranca, snapshot.normalized, snapshot.payload, snapshot.ready)
    const updated = await input.store.updateCharge(cobranca.id, patch)

    if (!updated) return fail('Falha ao sincronizar cobranca.', 500)

    const auditAction = input.auditAction ?? 'sincronizacao_manual'
    const eventType = input.eventType ?? auditAction
    const statusChanged = updated.status !== cobranca.status

    if (statusChanged) {
      await input.store.insertEvent({
        cobranca_id: cobranca.id,
        tipo: eventType,
        status_anterior: cobranca.status,
        status_novo: updated.status,
        payload: snapshot.payload ?? updated.payload_ultimo_status ?? null,
        created_by: input.userId,
      })
    }

    await input.store.insertLog({
      cobranca_id: cobranca.id,
      acao: auditAction,
      detalhe: snapshot.ready ? null : 'Cobranca ainda em processamento no Inter.',
      payload: snapshot.payload ?? updated.payload_ultimo_status ?? null,
      usuario_id: input.userId,
    })

    return ok(snapshot.ready ? 200 : 202, updated)
  } catch (error) {
    const message = error instanceof Error ? sanitizeInterError(error.message) : 'Falha desconhecida ao sincronizar no Inter.'
    await input.store.insertLog({
      cobranca_id: cobranca.id,
      acao: input.auditAction ?? 'sincronizacao_manual_erro',
      detalhe: message,
      usuario_id: input.userId,
    })
    return fail(message, 502)
  }
}

export async function handleInterWebhookAction(input: {
  store: CobrancasStore
  rawBody: string
  headers: WebhookHeadersLike | Record<string, string | null | undefined>
  secret?: string | null
}): Promise<ActionResult<{ ok: true; duplicate?: boolean; ignored?: boolean }>> {
  if (!input.secret) return fail('Webhook Inter nao configurado.', 503)
  if (Buffer.byteLength(input.rawBody, 'utf8') > WEBHOOK_MAX_BYTES) {
    return fail('Payload excede o limite permitido.', 413)
  }

  const receivedSecret = headerValue(input.headers, 'x-inter-webhook-secret') ?? headerValue(input.headers, 'x-webhook-secret')
  if (!receivedSecret || !safeCompareSecret(receivedSecret, input.secret)) {
    return fail('Assinatura invalida.', 401)
  }

  let payload: Record<string, unknown>
  try {
    payload = input.rawBody ? JSON.parse(input.rawBody) : {}
  } catch {
    return fail('Payload JSON invalido.', 400)
  }

  const parsed = await handleInterWebhook(payload)
  const eventId = String(
    payload.id ??
    payload.eventId ??
    payload.codigoNotificacao ??
    createHash('sha256').update(input.rawBody).digest('hex'),
  )

  const headerPayload = sanitizeWebhookHeaders(input.headers)
  const webhookEvent = await input.store.insertWebhookEvent({
    provider: 'inter',
    event_id: eventId,
    inter_cobranca_id: parsed.interCobrancaId,
    tipo: String(payload.tipo ?? payload.eventType ?? 'cobranca'),
    payload,
    headers: headerPayload,
  })

  if (webhookEvent.duplicate) {
    return ok(200, { ok: true, duplicate: true })
  }

  if (!parsed.interCobrancaId) {
    await input.store.updateWebhookEvent(webhookEvent.id, { processing_error: 'Identificador da cobranca ausente.' })
    return ok(200, { ok: true, ignored: true })
  }

  const cobranca = await input.store.findCobrancaByInterId(parsed.interCobrancaId)
  if (!cobranca) {
    await input.store.updateWebhookEvent(webhookEvent.id, { processing_error: 'Cobranca nao localizada.' })
    return ok(200, { ok: true, ignored: true })
  }

  const interStatus = parsed.interStatus || null
  const receivedStatus = mapInterStatusToInternal(interStatus)
  const status = cobranca.status === 'paga' && receivedStatus !== 'paga' ? 'paga' : receivedStatus
  const updated = await input.store.updateCharge(cobranca.id, {
    status,
    inter_status: interStatus,
    data_pagamento: status === 'paga' ? parsed.paidAt ?? cobranca.data_pagamento ?? new Date().toISOString() : null,
    valor_pago: status === 'paga' ? parsed.paidValue ?? cobranca.valor_pago ?? Number(cobranca.valor) : null,
    payload_ultimo_status: payload,
    erro_emissao: null,
  })

  if (!updated) return fail('Falha ao atualizar cobranca.', 500)

  await input.store.updateWebhookEvent(webhookEvent.id, {
    cobranca_id: cobranca.id,
    processed_at: new Date().toISOString(),
  })
  await input.store.insertEvent({
    cobranca_id: cobranca.id,
    tipo: 'webhook_inter',
    status_anterior: cobranca.status,
    status_novo: updated.status,
    payload,
  })
  await input.store.insertLog({
    cobranca_id: cobranca.id,
    acao: status === 'paga' ? 'baixa_webhook' : 'webhook_inter',
    payload,
  })

  return ok(200, { ok: true })
}

export function safeCompareSecret(received: string, expected: string) {
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function headerValue(headers: WebhookHeadersLike | Record<string, string | null | undefined>, name: string) {
  if ('get' in headers) {
    const getter = headers.get
    if (typeof getter === 'function') return getter.call(headers, name)
  }
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  const value = entry?.[1]
  return typeof value === 'string' ? value : null
}

export function sanitizeWebhookHeaders(headers: WebhookHeadersLike | Record<string, string | null | undefined>) {
  return {
    'content-type': headerValue(headers, 'content-type'),
    'user-agent': headerValue(headers, 'user-agent'),
    'x-forwarded-for': headerValue(headers, 'x-forwarded-for'),
    'x-real-ip': headerValue(headers, 'x-real-ip'),
  }
}

export { parseDateMonth }
