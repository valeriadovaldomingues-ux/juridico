import { createPrivateKey, createPublicKey, timingSafeEqual, X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'

type Json = Record<string, unknown>

interface InterConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  cert: Buffer
  key: Buffer
  ca: Buffer
}

interface InterChargeInput {
  id: string
  idempotencyKey: string
  valor: number
  data_vencimento: string
  descricao: string
  cliente?: {
    nome?: string | null
    cpf_cnpj?: string | null
    email?: string | null
  } | null
}

export interface NormalizedInterChargeResponse {
  inter_cobranca_id: string
  nosso_numero: string | null
  linha_digitavel: string | null
  codigo_barras: string | null
  pix_qrcode: string | null
  pix_copia_cola: string | null
  boleto_pdf_url: string | null
  inter_status: string | null
  paidAt: string | null
  paidValue: number | null
}

const INTER_PRODUCTION_HOST = 'cdpj.partners.bancointer.com.br'

function getConfig(): InterConfig {
  return buildInterConfig(process.env)
}

function readRequiredEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(`Configure ${name} no ambiente server-side.`)
  }
  return value
}

function stripWrappingQuotes(value: string) {
  let normalized = value.trim()
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’'],
  ]

  for (const [open, close] of pairs) {
    if (normalized.startsWith(open) && normalized.endsWith(close)) {
      normalized = normalized.slice(open.length, -close.length).trim()
      break
    }
  }

  return normalized
}

function decodeBase64Material(value: string, label: string) {
  const normalized = stripWrappingQuotes(value).replace(/\s+/g, '')
  if (!normalized) {
    throw new Error(`Configure ${label} no ambiente server-side.`)
  }

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    throw new Error(`Valor Base64 invalido para ${label}.`)
  }

  const decoded = Buffer.from(normalized, 'base64')
  const roundTrip = Buffer.from(decoded).toString('base64').replace(/=+$/g, '')
  const expected = normalized.replace(/=+$/g, '')

  if (!decoded.length || roundTrip !== expected) {
    throw new Error(`Valor Base64 invalido para ${label}.`)
  }

  return decoded
}

function loadInterMaterial(
  env: NodeJS.ProcessEnv,
  base64Name: string,
  pathName: string,
  allowLocalPaths: boolean,
) {
  const base64Value = env[base64Name]
  if (base64Value) {
    return decodeBase64Material(base64Value, base64Name)
  }

  if (allowLocalPaths) {
    const path = env[pathName]
    if (path) {
      return readFileSync(path)
    }
  }

  throw new Error(`Configure ${base64Name} no ambiente server-side.`)
}

function loadPrivateKey(material: Buffer) {
  const text = material.toString('utf8')

  if (text.includes('-----BEGIN')) {
    if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(text)) {
      throw new Error('Chave privada do Banco Inter invalida.')
    }

    try {
      return createPrivateKey(text)
    } catch {
      throw new Error('Chave privada do Banco Inter invalida.')
    }
  }

  try {
    return createPrivateKey({ key: material, format: 'der', type: 'pkcs8' })
  } catch {
    try {
      return createPrivateKey({ key: material, format: 'der', type: 'pkcs1' })
    } catch {
      throw new Error('Chave privada do Banco Inter invalida.')
    }
  }
}

function validateCertificatePair(cert: Buffer, key: Buffer) {
  let certPublic: Buffer
  let keyPublic: Buffer

  try {
    const certificate = new X509Certificate(cert)
    certPublic = Buffer.from(certificate.publicKey.export({ format: 'der', type: 'spki' }))
  } catch {
    throw new Error('Certificado do Banco Inter invalido.')
  }

  const privateKey = loadPrivateKey(key)
  try {
    keyPublic = Buffer.from(createPublicKey(privateKey).export({ format: 'der', type: 'spki' }))
  } catch {
    throw new Error('Chave privada do Banco Inter invalida.')
  }

  if (certPublic.length !== keyPublic.length || !timingSafeEqual(certPublic, keyPublic)) {
    throw new Error('Certificado e chave do Banco Inter nao correspondem.')
  }
}

function validateCertificateAuthority(ca: Buffer) {
  try {
    new X509Certificate(ca)
  } catch {
    throw new Error('INTER_WEBHOOK_CA_BASE64 invalido.')
  }
}

function parseBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl)
  } catch {
    throw new Error('INTER_BASE_URL invalida.')
  }
}

export function isStagingDeployment(env: NodeJS.ProcessEnv = process.env) {
  const flags = [
    env.NODE_ENV,
    env.APP_ENV,
    env.DEPLOY_ENV,
    env.VERCEL_ENV,
  ]
    .filter(Boolean)
    .map(value => value!.toLowerCase())

  if (flags.some(value => value === 'staging' || value === 'preview')) return true

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? ''
  return /staging|preview/i.test(appUrl)
}

export function isInterProductionBaseUrl(baseUrl: string) {
  return parseBaseUrl(baseUrl).hostname.toLowerCase() === INTER_PRODUCTION_HOST
}

export function buildInterConfig(env: NodeJS.ProcessEnv = process.env): InterConfig {
  const clientId = readRequiredEnv(env, 'INTER_CLIENT_ID')
  const clientSecret = readRequiredEnv(env, 'INTER_CLIENT_SECRET')
  const baseUrl = readRequiredEnv(env, 'INTER_BASE_URL')

  if (isStagingDeployment(env) && isInterProductionBaseUrl(baseUrl)) {
    throw new Error('INTER_BASE_URL de producao bloqueada em staging. Use homologacao do Inter.')
  }

  const allowLocalPaths = env.NODE_ENV === 'development'
  const cert = loadInterMaterial(env, 'INTER_CERT_BASE64', 'INTER_CERT_PATH', allowLocalPaths)
  const key = loadInterMaterial(env, 'INTER_KEY_BASE64', 'INTER_KEY_PATH', allowLocalPaths)
  const ca = loadInterMaterial(env, 'INTER_WEBHOOK_CA_BASE64', 'INTER_WEBHOOK_CA_PATH', allowLocalPaths)

  validateCertificatePair(cert, key)
  validateCertificateAuthority(ca)
  const parsedBaseUrl = parseBaseUrl(baseUrl)

  return {
    clientId,
    clientSecret,
    baseUrl: parsedBaseUrl.toString(),
    cert,
    key,
    ca,
  }
}

function requestJson<T>(
  method: string,
  path: string,
  body?: Json | URLSearchParams,
  headers: Record<string, string> = {},
): Promise<T> {
  const config = getConfig()
  const url = new URL(path, config.baseUrl)
  const payload =
    body instanceof URLSearchParams
      ? body.toString()
      : body
        ? JSON.stringify(body)
        : undefined

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method,
        cert: config.cert,
        key: config.key,
        ca: config.ca,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload).toString() } : {}),
          ...headers,
        },
      },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', chunk => chunks.push(Buffer.from(chunk)))
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8')
            if ((res.statusCode ?? 500) >= 400) {
              reject(new Error(`Inter API ${res.statusCode}: ${sanitizeInterError(raw || res.statusMessage || 'erro')}`))
              return
            }
            const parsed = parseJson(raw)
            resolve(parsed as T)
          })
      },
    )

    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

export async function getInterAccessToken(): Promise<string> {
  const config = getConfig()
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope: process.env.INTER_TOKEN_SCOPE ?? 'boleto-cobranca.write boleto-cobranca.read',
  })

  const data = await requestJson<{ access_token: string }>('POST', '/oauth/v2/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  })

  return data.access_token
}

export async function createInterCharge(input: InterChargeInput) {
  const token = await getInterAccessToken()
  const endpoint = process.env.INTER_CREATE_CHARGE_PATH ?? '/cobranca/v3/cobrancas'
  const cpfCnpj = input.cliente?.cpf_cnpj?.replace(/\D/g, '')
  const payload: Json = {
    seuNumero: input.id.slice(0, 15),
    valorNominal: Number(input.valor.toFixed(2)),
    dataVencimento: input.data_vencimento,
    numDiasAgenda: Number(process.env.INTER_NUM_DIAS_AGENDA ?? 60),
    pagador: {
      nome: input.cliente?.nome ?? 'Cliente PEDV',
      cpfCnpj: cpfCnpj || undefined,
      email: input.cliente?.email || undefined,
    },
    mensagem: {
      linha1: input.descricao.slice(0, 78),
    },
  }

  return requestJson<Json>('POST', endpoint, payload, {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-idempotency-key': input.idempotencyKey,
  })
}

export function sanitizeInterError(message: string) {
  return message
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[redacted]"')
    .replace(/"client_secret"\s*:\s*"[^"]+"/gi, '"client_secret":"[redacted]"')
    .replace(/client_secret\s*=\s*[^&\s]+/gi, 'client_secret=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[redacted pem]')
    .slice(0, 1000)
}

function parseJson(raw: string) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return { raw }
  }
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function extractPaymentDate(payload: Json, nested: Json) {
  const payment = (payload.pagamento as Json | undefined) ?? (nested.pagamento as Json | undefined)
  return firstString(
    payment?.dataPagamento,
    payment?.data_pagamento,
    payload.dataPagamento,
    payload.data_pagamento,
    nested.dataPagamento,
    nested.data_pagamento,
  )
}

function extractPaymentValue(payload: Json, nested: Json) {
  const payment = (payload.pagamento as Json | undefined) ?? (nested.pagamento as Json | undefined)
  const raw = payment?.valorPago ?? payment?.valor_pago ?? payload.valorPago ?? payload.valor_pago ?? nested.valorPago ?? nested.valor_pago
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) ? value : null
}

function extractPdfUrl(payload: Json, nested: Json) {
  const boleto = (payload.boleto as Json | undefined) ?? (nested.boleto as Json | undefined)
  return firstString(
    payload.boleto_pdf_url,
    payload.boletoPdfUrl,
    payload.pdfUrl,
    payload.urlPdf,
    payload.linkPdf,
    payload.link_pdf,
    payload.pdf,
    boleto?.pdfUrl,
    boleto?.pdf_url,
    boleto?.url,
    boleto?.link,
    boleto?.linkPdf,
    boleto?.downloadUrl,
    nested.boleto_pdf_url,
    nested.boletoPdfUrl,
    nested.pdfUrl,
    nested.urlPdf,
    nested.linkPdf,
    nested.link_pdf,
  )
}

export async function getInterCharge(interCobrancaId: string) {
  const token = await getInterAccessToken()
  const template = process.env.INTER_GET_CHARGE_PATH ?? '/cobranca/v3/cobrancas/{id}'
  const path = template.replace('{id}', encodeURIComponent(interCobrancaId))

  return requestJson<Json>('GET', path, undefined, {
    Authorization: `Bearer ${token}`,
  })
}

export async function getInterChargePdf(interCobrancaId: string) {
  const token = await getInterAccessToken()
  const template = process.env.INTER_GET_CHARGE_PDF_PATH ?? '/cobranca/v3/cobrancas/{id}/pdf'
  const path = template.replace('{id}', encodeURIComponent(interCobrancaId))

  return requestJson<Json>('GET', path, undefined, {
    Authorization: `Bearer ${token}`,
  })
}

export async function cancelInterCharge(interCobrancaId: string, motivo = 'Cancelado pelo PEDV') {
  const token = await getInterAccessToken()
  const template = process.env.INTER_CANCEL_CHARGE_PATH ?? '/cobranca/v3/cobrancas/{id}/cancelar'
  const path = template.replace('{id}', encodeURIComponent(interCobrancaId))

  return requestJson<Json>('POST', path, { motivoCancelamento: motivo }, {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  })
}

export function normalizeInterChargeResponse(payload: Json): NormalizedInterChargeResponse {
  const nested = (payload.cobranca as Json | undefined) ?? payload
  const pix = (payload.pix as Json | undefined) ?? (nested.pix as Json | undefined)
  return {
    inter_cobranca_id:
      String(nested.codigoSolicitacao ?? nested.id ?? nested.codigoCobranca ?? payload.codigoSolicitacao ?? ''),
    nosso_numero: nested.nossoNumero ? String(nested.nossoNumero) : null,
    linha_digitavel: nested.linhaDigitavel ? String(nested.linhaDigitavel) : null,
    codigo_barras: nested.codigoBarras ? String(nested.codigoBarras) : null,
    pix_qrcode: pix?.qrCode ? String(pix.qrCode) : null,
    pix_copia_cola: pix?.pixCopiaECola ? String(pix.pixCopiaECola) : pix?.copiaECola ? String(pix.copiaECola) : null,
    boleto_pdf_url: extractPdfUrl(payload, nested),
    inter_status: nested.situacao ? String(nested.situacao) : null,
    paidAt: extractPaymentDate(payload, nested),
    paidValue: extractPaymentValue(payload, nested),
  }
}

export function mapInterStatusToInternal(status?: string | null) {
  const normalized = (status ?? '').toLowerCase()
  if (['pago', 'paga', 'liquidado', 'liquidada', 'recebido'].some(s => normalized.includes(s))) return 'paga'
  if (['cancelado', 'cancelada', 'baixado'].some(s => normalized.includes(s))) return 'cancelada'
  if (['vencido', 'vencida'].some(s => normalized.includes(s))) return 'vencida'
  if (['processando', 'em_processamento', 'em processamento', 'processamento', 'aguardando', 'gerando', 'nao gerada', 'nao_gerada'].some(s => normalized.includes(s))) return 'processando'
  return 'emitida'
}

export async function handleInterWebhook(payload: Json) {
  const interCobrancaId =
    payload.codigoSolicitacao ??
    payload.codigoCobranca ??
    payload.idCobranca ??
    (payload.cobranca as Json | undefined)?.codigoSolicitacao

  return {
    interCobrancaId: interCobrancaId ? String(interCobrancaId) : null,
    interStatus: String(payload.situacao ?? payload.status ?? (payload.cobranca as Json | undefined)?.situacao ?? ''),
    paidAt: payload.dataPagamento ? String(payload.dataPagamento) : null,
    paidValue: payload.valorPago ? Number(payload.valorPago) : null,
  }
}
