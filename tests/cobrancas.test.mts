import { test } from 'vitest'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Cobranca, CobrancaDuplicateKey } from '../src/types/cobrancas'
import {
  COBRANCAS_ALLOWED_ROLES,
  WEBHOOK_MAX_BYTES,
  createRecurringCobrancasAction,
  createSingleCobrancaAction,
  emitInterCobrancaAction,
  handleInterWebhookAction,
  syncInterCobrancaAction,
} from '../src/lib/cobrancas-workflow'
import type { CobrancasStore } from '../src/lib/cobrancas-store'

const NOW = '2030-01-01T12:00:00.000Z'

function makeCobranca(partial: Partial<Cobranca> = {}): Cobranca {
  return {
    id: randomUUID(),
    cliente_id: 'cliente-1',
    contrato_id: null,
    processo_id: null,
    valor: 1500,
    data_vencimento: '2099-01-10',
    descricao: 'Honorarios',
    parcela_numero: 1,
    parcela_total: 1,
    status: 'pendente',
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
    created_by: 'user-1',
    created_at: NOW,
    updated_at: NOW,
    cliente: null,
    processo: null,
    ...partial,
  }
}

function createTestStore(seed: {
  charges?: Partial<Cobranca>[]
  processos?: Array<{ id: string; cliente_id: string | null }>
} = {}) {
  const charges = (seed.charges ?? []).map(makeCobranca)
  const processos = new Map((seed.processos ?? []).map(p => [p.id, p]))
  const events: Record<string, unknown>[] = []
  const logs: Record<string, unknown>[] = []
  const webhookEventsById = new Map<string, Record<string, unknown>>()
  const webhookEventsByEventId = new Map<string, string>()

  const store: CobrancasStore = {
    async findProcessoById(id) {
      return processos.get(id) ?? null
    },
    async findCobrancaById(id) {
      return charges.find(c => c.id === id) ?? null
    },
    async findCobrancaByInterId(interCobrancaId) {
      return charges.find(c => c.inter_cobranca_id === interCobrancaId) ?? null
    },
    async findDuplicateCharge(key: CobrancaDuplicateKey) {
      return charges.find(c =>
        c.status !== 'cancelada' &&
        c.cliente_id === key.cliente_id &&
        c.processo_id === key.processo_id &&
        Number(c.valor) === Number(key.valor) &&
        c.data_vencimento === key.data_vencimento &&
        c.parcela_numero === key.parcela_numero &&
        c.parcela_total === key.parcela_total
      ) ?? null
    },
    async createCharge(input) {
      const row = makeCobranca({ ...input, id: randomUUID(), created_at: NOW, updated_at: NOW })
      charges.push(row)
      return row
    },
    async createCharges(inputs) {
      const created: Cobranca[] = []
      for (const input of inputs) {
        const row = await store.createCharge(input)
        created.push(row)
      }
      return created
    },
    async updateCharge(id, patch) {
      const index = charges.findIndex(c => c.id === id)
      if (index === -1) return null
      charges[index] = { ...charges[index], ...patch, updated_at: NOW }
      return charges[index]
    },
    async insertEvent(row) {
      events.push(row)
    },
    async insertLog(row) {
      logs.push(row)
    },
    async insertWebhookEvent(row) {
      const eventId = String(row.event_id)
      const existingId = webhookEventsByEventId.get(eventId)
      if (existingId) return { id: existingId, duplicate: true }
      const id = `wh_${webhookEventsById.size + 1}`
      webhookEventsById.set(id, { id, ...row })
      webhookEventsByEventId.set(eventId, id)
      return { id }
    },
    async updateWebhookEvent(id, patch) {
      const current = webhookEventsById.get(id)
      if (!current) throw new Error('webhook event not found')
      const next = { ...current, ...patch }
      webhookEventsById.set(id, next)
      if (typeof next.event_id === 'string') {
        webhookEventsByEventId.set(next.event_id, id)
      }
    },
  }

  return {
    store,
    charges,
    events,
    logs,
    webhookEventsById,
    webhookEventsByEventId,
  }
}

function createFakeInter(options?: {
  createPayload?: Record<string, unknown>
  getPayload?: Record<string, unknown>
  getPayloads?: Array<Record<string, unknown>>
}) {
  const state = {
    lastCreateInput: null as null | {
      id: string
      idempotencyKey: string
      valor: number
      data_vencimento: string
      descricao: string
      cliente?: { nome?: string | null; cpf_cnpj?: string | null; email?: string | null } | null
    },
    lastGetId: null as null | string,
    getCalls: 0,
  }

  const gateway = {
    async createInterCharge(input: {
      id: string
      idempotencyKey: string
      valor: number
      data_vencimento: string
      descricao: string
      cliente?: { nome?: string | null; cpf_cnpj?: string | null; email?: string | null } | null
    }) {
      state.lastCreateInput = input
      return options?.createPayload ?? {
        codigoCobranca: 'inter-1',
        nossoNumero: 'NOSSO-1',
        linhaDigitavel: '12345',
        codigoBarras: '98765',
        pix: {
          qrCode: 'qr-code',
          pixCopiaECola: 'pix-copy',
        },
        situacao: 'ABERTA',
      }
    },
    async getInterCharge(interCobrancaId: string) {
      state.lastGetId = interCobrancaId
      state.getCalls += 1
      if (options?.getPayloads?.length) {
        return options.getPayloads[Math.min(state.getCalls - 1, options.getPayloads.length - 1)]
      }
      return options?.getPayload ?? {
        codigoCobranca: interCobrancaId,
        situacao: 'VENCIDO',
        nossoNumero: 'NOSSO-2',
        linhaDigitavel: '67890',
        codigoBarras: '54321',
        pix: {
          qrCode: 'qr-sync',
          pixCopiaECola: 'pix-sync',
        },
      }
    },
  }

  return { state, gateway }
}

function assertOk<T>(result: { ok: boolean; status: number; data?: T; error?: string }) {
  assert.equal(result.ok, true, result.error ?? 'expected ok result')
  if (!result.ok) throw new Error(result.error ?? 'expected ok result')
  return result.data as T
}

test('RBAC allows only financeiro profiles on cobrancas actions', async () => {
  const store = createTestStore({
    processos: [{ id: 'proc-1', cliente_id: 'cliente-1' }],
  })

  const result = await createSingleCobrancaAction({
    role: 'advogado',
    userId: 'user-1',
    store: store.store,
    body: {
      cliente_id: 'cliente-1',
      processo_id: 'proc-1',
      valor: 1500,
      data_vencimento: '2099-01-10',
      descricao: 'Honorarios',
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
  assert.equal(COBRANCAS_ALLOWED_ROLES.join(','), 'administrativo,gerente,socio')
})

test('creates a single charge and validates process ownership', async () => {
  const store = createTestStore({
    processos: [{ id: 'proc-1', cliente_id: 'cliente-1' }],
  })

  const result = await createSingleCobrancaAction({
    role: 'administrativo',
    userId: 'user-1',
    store: store.store,
    body: {
      cliente_id: 'cliente-1',
      processo_id: 'proc-1',
      valor: 1500,
      data_vencimento: '2099-01-10',
      descricao: 'Honorarios mensais',
    },
  })

  const cobranca = assertOk<Cobranca>(result)
  assert.equal(cobranca.status, 'pendente')
  assert.equal(cobranca.cliente_id, 'cliente-1')
  assert.equal(store.charges.length, 1)
  assert.equal(store.events.length, 1)
  assert.equal(store.logs.length, 1)
})

test('rejects incompatible client/process linkage', async () => {
  const store = createTestStore({
    processos: [{ id: 'proc-2', cliente_id: 'cliente-2' }],
  })

  const result = await createSingleCobrancaAction({
    role: 'administrativo',
    userId: 'user-1',
    store: store.store,
    body: {
      cliente_id: 'cliente-1',
      processo_id: 'proc-2',
      valor: 1500,
      data_vencimento: '2099-01-10',
      descricao: 'Honorarios mensais',
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.match(result.error ?? '', /nao pertence ao cliente/i)
})

test('blocks duplicate charge creation for the same parcela', async () => {
  const store = createTestStore({
    charges: [
      {
        cliente_id: 'cliente-1',
        processo_id: 'proc-1',
        valor: 1500,
        data_vencimento: '2099-01-10',
        parcela_numero: 1,
        parcela_total: 1,
      },
    ],
    processos: [{ id: 'proc-1', cliente_id: 'cliente-1' }],
  })

  const result = await createSingleCobrancaAction({
    role: 'administrativo',
    userId: 'user-1',
    store: store.store,
    body: {
      cliente_id: 'cliente-1',
      processo_id: 'proc-1',
      valor: 1500,
      data_vencimento: '2099-01-10',
      descricao: 'Honorarios mensais',
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
})

test('creates recurring charges across monthly parcels', async () => {
  const store = createTestStore({
    processos: [{ id: 'proc-1', cliente_id: 'cliente-1' }],
  })

  const result = await createRecurringCobrancasAction({
    role: 'gerente',
    userId: 'user-1',
    store: store.store,
    body: {
      cliente_id: 'cliente-1',
      processo_id: 'proc-1',
      valor: 1200,
      data_vencimento_inicial: '2099-01-10',
      quantidade_parcelas: 3,
      dia_vencimento: 10,
      descricao: 'Honorarios recorrentes',
    },
  })

  const charges = assertOk<Cobranca[]>(result)
  assert.equal(charges.length, 3)
  assert.deepEqual(charges.map(c => c.parcela_numero), [1, 2, 3])
  assert.deepEqual(charges.map(c => c.data_vencimento), ['2099-01-10', '2099-02-10', '2099-03-10'])
})

test('blocks duplicate recurring parcel generation', async () => {
  const store = createTestStore({
    charges: [
      {
        cliente_id: 'cliente-1',
        processo_id: 'proc-1',
        valor: 1200,
        data_vencimento: '2099-02-10',
        parcela_numero: 2,
        parcela_total: 3,
      },
    ],
    processos: [{ id: 'proc-1', cliente_id: 'cliente-1' }],
  })

  const result = await createRecurringCobrancasAction({
    role: 'gerente',
    userId: 'user-1',
    store: store.store,
    body: {
      cliente_id: 'cliente-1',
      processo_id: 'proc-1',
      valor: 1200,
      data_vencimento_inicial: '2099-01-10',
      quantidade_parcelas: 3,
      dia_vencimento: 10,
      descricao: 'Honorarios recorrentes',
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
})

test('emits charge to Inter and finalizes after active consultation retries', async () => {
  const seededCharge = makeCobranca({
    id: 'charge-1',
    cliente_id: 'cliente-1',
    cliente: {
      id: 'cliente-1',
      nome: 'Cliente Teste',
      cpf_cnpj: '12345678000199',
      email: 'cliente@exemplo.com',
    },
    valor: 2000,
    data_vencimento: '2099-01-10',
    status: 'erro_emissao',
    idempotency_key: 'idem-123',
  })
  const store = createTestStore({ charges: [seededCharge] })
  const inter = createFakeInter({
    createPayload: {
      codigoCobranca: 'inter-1',
      situacao: 'PROCESSANDO',
    },
    getPayloads: [
      {
        codigoCobranca: 'inter-1',
        situacao: 'PROCESSANDO',
      },
      {
        codigoCobranca: 'inter-1',
        situacao: 'ABERTA',
        nossoNumero: 'NOSSO-1',
        linhaDigitavel: '12345',
        codigoBarras: '98765',
        pix: {
          qrCode: 'qr-code',
          pixCopiaECola: 'pix-copy',
        },
        boletoPdfUrl: 'https://inter.exemplo/pdf/inter-1.pdf',
      },
    ],
  })

  const result = await emitInterCobrancaAction({
    role: 'socio',
    userId: 'user-1',
    store: store.store,
    inter: inter.gateway,
    id: 'charge-1',
  })

  const cobranca = assertOk<Cobranca>(result)
  assert.equal(result.status, 200)
  assert.equal(cobranca.status, 'emitida')
  assert.equal(cobranca.inter_cobranca_id, 'inter-1')
  assert.equal(cobranca.linha_digitavel, '12345')
  assert.equal(cobranca.codigo_barras, '98765')
  assert.equal(cobranca.pix_qrcode, 'qr-code')
  assert.equal(cobranca.pix_copia_cola, 'pix-copy')
  assert.equal(cobranca.boleto_pdf_url, 'https://inter.exemplo/pdf/inter-1.pdf')
  assert.equal(inter.state.lastCreateInput?.idempotencyKey, 'idem-123')
  assert.equal(inter.state.getCalls, 2)
  assert.equal(store.events.length, 2)
  assert.equal(store.logs.length, 2)
})

test('emission stays processando when Inter still has not confirmed generation', async () => {
  const seededCharge = makeCobranca({
    id: 'charge-pending',
    cliente_id: 'cliente-1',
    cliente: {
      id: 'cliente-1',
      nome: 'Cliente Teste',
      cpf_cnpj: '12345678000199',
      email: 'cliente@exemplo.com',
    },
    valor: 2000,
    data_vencimento: '2099-01-10',
    status: 'erro_emissao',
    idempotency_key: 'idem-pending',
  })
  const store = createTestStore({ charges: [seededCharge] })
  const inter = createFakeInter({
    createPayload: {
      codigoCobranca: 'inter-pending',
      situacao: 'PROCESSANDO',
    },
    getPayloads: [
      { codigoCobranca: 'inter-pending', situacao: 'PROCESSANDO' },
      { codigoCobranca: 'inter-pending', situacao: 'PROCESSANDO' },
      { codigoCobranca: 'inter-pending', situacao: 'PROCESSANDO' },
    ],
  })

  const result = await emitInterCobrancaAction({
    role: 'socio',
    userId: 'user-1',
    store: store.store,
    inter: inter.gateway,
    id: 'charge-pending',
  })

  const cobranca = assertOk<Cobranca>(result)
  assert.equal(result.status, 202)
  assert.equal(cobranca.status, 'processando')
  assert.equal(cobranca.inter_cobranca_id, 'inter-pending')
  assert.equal(cobranca.linha_digitavel, null)
  assert.equal(inter.state.getCalls, 3)
})

test('webhook rejects requests without a secret', async () => {
  const store = createTestStore()
  const result = await handleInterWebhookAction({
    store: store.store,
    rawBody: '{"codigoSolicitacao":"inter-1","situacao":"PAGO"}',
    headers: new Headers(),
    secret: 'segredo',
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
})

test('webhook rejects requests with an invalid secret', async () => {
  const store = createTestStore()
  const result = await handleInterWebhookAction({
    store: store.store,
    rawBody: '{"codigoSolicitacao":"inter-1","situacao":"PAGO"}',
    headers: new Headers([['x-inter-webhook-secret', 'errado']]),
    secret: 'segredo',
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
})

test('webhook deduplicates repeated events', async () => {
  const store = createTestStore({
    charges: [
      {
        id: 'charge-1',
        cliente_id: 'cliente-1',
        inter_cobranca_id: 'inter-1',
        status: 'emitida',
        valor: 2000,
        data_vencimento: '2099-01-10',
      },
    ],
  })

  const rawBody = JSON.stringify({
    id: 'event-1',
    codigoSolicitacao: 'inter-1',
    situacao: 'PAGO',
    dataPagamento: '2030-01-15T10:00:00Z',
    valorPago: 2000,
  })

  const first = await handleInterWebhookAction({
    store: store.store,
    rawBody,
    headers: new Headers([['x-inter-webhook-secret', 'segredo']]),
    secret: 'segredo',
  })
  const second = await handleInterWebhookAction({
    store: store.store,
    rawBody,
    headers: new Headers([['x-inter-webhook-secret', 'segredo']]),
    secret: 'segredo',
  })

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.deepEqual((second.ok ? second.data : null), { ok: true, duplicate: true })
  assert.equal(store.webhookEventsById.size, 1)
  assert.equal(store.charges[0].status, 'paga')
})

test('webhook rejects payloads above 256 KB', async () => {
  const store = createTestStore()
  const result = await handleInterWebhookAction({
    store: store.store,
    rawBody: 'x'.repeat(WEBHOOK_MAX_BYTES + 1),
    headers: new Headers([['x-inter-webhook-secret', 'segredo']]),
    secret: 'segredo',
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 413)
})

test('webhook keeps paid charges paid even when Inter sends a lower status', async () => {
  const store = createTestStore({
    charges: [
      {
        id: 'charge-paid',
        cliente_id: 'cliente-1',
        inter_cobranca_id: 'inter-paid',
        status: 'paga',
        data_pagamento: '2030-01-10T10:00:00Z',
        valor_pago: 2000,
        valor: 2000,
      },
    ],
  })

  const rawBody = JSON.stringify({
    id: 'event-paid',
    codigoSolicitacao: 'inter-paid',
    situacao: 'VENCIDO',
  })

  const result = await handleInterWebhookAction({
    store: store.store,
    rawBody,
    headers: new Headers([['x-inter-webhook-secret', 'segredo']]),
    secret: 'segredo',
  })

  assert.equal(result.ok, true)
  assert.equal(store.charges[0].status, 'paga')
})

test('manual sync fills boleto, pix and payment data when Inter confirms the charge', async () => {
  const store = createTestStore({
    charges: [
      {
        id: 'charge-sync',
        cliente_id: 'cliente-1',
        inter_cobranca_id: 'inter-sync',
        status: 'processando',
        valor: 2000,
        data_vencimento: '2099-01-10',
      },
    ],
  })
  const inter = createFakeInter({
    getPayload: {
      codigoCobranca: 'inter-sync',
      situacao: 'PAGO',
      nossoNumero: 'NOSSO-2',
      linhaDigitavel: '67890',
      codigoBarras: '54321',
      pix: {
        qrCode: 'qr-sync',
        pixCopiaECola: 'pix-sync',
      },
      boletoPdfUrl: 'https://inter.exemplo/pdf/inter-sync.pdf',
      dataPagamento: '2030-01-15T10:00:00Z',
      valorPago: 2000,
    },
  })

  const result = await syncInterCobrancaAction({
    role: 'socio',
    userId: 'user-1',
    store: store.store,
    inter: inter.gateway,
    id: 'charge-sync',
  })

  const cobranca = assertOk<Cobranca>(result)
  assert.equal(result.status, 200)
  assert.equal(cobranca.status, 'paga')
  assert.equal(cobranca.linha_digitavel, '67890')
  assert.equal(cobranca.pix_copia_cola, 'pix-sync')
  assert.equal(cobranca.boleto_pdf_url, 'https://inter.exemplo/pdf/inter-sync.pdf')
  assert.equal(cobranca.data_pagamento, '2030-01-15T10:00:00Z')
  assert.equal(cobranca.valor_pago, 2000)
})

test('manual sync keeps paid charges paid even if Inter returns a lower status', async () => {
  const store = createTestStore({
    charges: [
      {
        id: 'charge-sync',
        cliente_id: 'cliente-1',
        inter_cobranca_id: 'inter-sync',
        status: 'paga',
        data_pagamento: '2030-01-10T10:00:00Z',
        valor_pago: 2000,
        valor: 2000,
      },
    ],
  })
  const inter = createFakeInter({
    getPayload: {
      codigoCobranca: 'inter-sync',
      situacao: 'VENCIDO',
    },
  })

  const result = await syncInterCobrancaAction({
    role: 'socio',
    userId: 'user-1',
    store: store.store,
    inter: inter.gateway,
    id: 'charge-sync',
  })

  const cobranca = assertOk<Cobranca>(result)
  assert.equal(cobranca.status, 'paga')
  assert.equal(inter.state.lastGetId, 'inter-sync')
})
