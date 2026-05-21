export interface GmailCleanupPreviewInput {
  remetente?: string
  assunto?: string
  palavraChave?: string
  anteriorA?: string
  posteriorA?: string
  comAnexos?: boolean
  maxResults?: number
}

export type GmailRiskCategory =
  | 'propaganda_newsletter'
  | 'spam_provavel'
  | 'possivelmente_importante'
  | 'juridico_processual'
  | 'cliente_contato_humano'
  | 'financeiro_banco_pagamento'
  | 'nao_classificado'

export type GmailConfidence = 'baixa' | 'media' | 'alta'

export interface GmailPreviewMessage {
  id: string
  threadId: string
  from: string
  subject: string
  date: string | null
  snippet: string
  labelIds: string[]
  categoria: GmailRiskCategory
  confianca: GmailConfidence
  preSelecionado: boolean
  alertaAnexo: boolean
  sugestao: 'revisar' | 'manter' | 'candidata_publicacao' | 'candidata_limpeza'
  motivos: string[]
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>
  resultSizeEstimate?: number
}

interface GmailGetResponse {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
}

function normalizeDateForGmail(value?: string): string | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return `${match[1]}/${match[2]}/${match[3]}`
}

function sanitizeTerm(value?: string): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/[{}[\]]/g, '').slice(0, 120)
}

export function buildGmailCleanupQuery(input: GmailCleanupPreviewInput): string {
  const parts: string[] = []
  const remetente = sanitizeTerm(input.remetente)
  const assunto = sanitizeTerm(input.assunto)
  const palavraChave = sanitizeTerm(input.palavraChave)
  const after = normalizeDateForGmail(input.posteriorA)
  const before = normalizeDateForGmail(input.anteriorA)

  if (remetente) parts.push(`from:${remetente}`)
  if (assunto) parts.push(`subject:(${assunto})`)
  if (palavraChave) parts.push(palavraChave)
  if (after) parts.push(`after:${after}`)
  if (before) parts.push(`before:${before}`)
  if (input.comAnexos) parts.push('has:attachment')

  return parts.join(' ').trim() || 'newer_than:30d'
}

async function gmailFetch<T>(accessToken: string, endpoint: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const bodyText = await res.text()
  const body = bodyText ? JSON.parse(bodyText) : {}
  if (!res.ok) {
    throw new Error(`Gmail HTTP ${res.status}: ${body.error?.message ?? res.statusText}`)
  }
  return body as T
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find(item => item.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

const TERMOS_PROTEGIDOS = [
  'processo',
  'intimacao',
  'intimação',
  'publicacao',
  'publicação',
  'prazo',
  'audiencia',
  'audiência',
  'tribunal',
  'pje',
  'dje',
  'djen',
  'eproc',
  'e-saj',
  'esaj',
  'cliente',
  'contrato',
  'boleto',
  'pagamento',
  'nota fiscal',
  'cobranca',
  'cobrança',
  'banco',
]

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function hasAnyTerm(haystack: string, terms: string[]): boolean {
  const normalized = normalizeText(haystack)
  return terms.some(term => normalized.includes(normalizeText(term)))
}

function remetentePareceHumano(from: string): boolean {
  const lower = from.toLowerCase()
  if (/(no-?reply|noreply|newsletter|marketing|mailer-daemon|notification|notifications|naoresponda|não-responda)/i.test(lower)) {
    return false
  }
  const emailMatch = lower.match(/<([^>]+)>/)?.[1] ?? lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0] ?? ''
  const displayName = from.replace(/<[^>]+>/g, '').replace(/"/g, '').trim()
  const freeMail = /@(gmail|hotmail|outlook|icloud|yahoo|uol|bol)\./i.test(emailMatch)
  return freeMail || displayName.split(/\s+/).filter(Boolean).length >= 2
}

export function classifyMessage(
  message: GmailGetResponse,
  options: { hasAttachmentQuery?: boolean } = {},
): Pick<GmailPreviewMessage, 'categoria' | 'confianca' | 'preSelecionado' | 'alertaAnexo' | 'sugestao' | 'motivos'> {
  const subject = header(message.payload?.headers, 'Subject')
  const from = header(message.payload?.headers, 'From')
  const snippet = message.snippet ?? ''
  const haystack = `${subject} ${from} ${snippet}`.toLowerCase()
  const motivos: string[] = []
  const labelIds = message.labelIds ?? []
  const alertaAnexo = options.hasAttachmentQuery || labelIds.includes('HAS_ATTACHMENT')

  if (alertaAnexo) motivos.push('Possui anexo ou foi encontrado em busca com anexos; revisar com cuidado')

  if (/(intima[cç][aã]o|publica[cç][aã]o|dje|djen|di[aá]rio|pje|eproc|e-saj|esaj|prazo|audi[eê]ncia|tribunal|comunica[cç][aã]o processual|processo)/i.test(haystack)) {
    motivos.push('Contém termos jurídicos/processuais protegidos')
    return {
      categoria: 'juridico_processual',
      confianca: 'alta',
      preSelecionado: false,
      alertaAnexo,
      sugestao: 'candidata_publicacao',
      motivos,
    }
  }

  if (/(boleto|pagamento|nota fiscal|cobran[cç]a|banco|pix|cart[aã]o|fatura|financeiro)/i.test(haystack)) {
    motivos.push('Contém termos financeiros protegidos')
    return {
      categoria: 'financeiro_banco_pagamento',
      confianca: 'alta',
      preSelecionado: false,
      alertaAnexo,
      sugestao: 'revisar',
      motivos,
    }
  }

  if (/(cliente|contrato|proposta|reuni[aã]o|retorno|documento|assinatura)/i.test(haystack)) {
    motivos.push('Pode envolver cliente, contato humano ou documento relevante')
    return {
      categoria: 'cliente_contato_humano',
      confianca: 'media',
      preSelecionado: false,
      alertaAnexo,
      sugestao: 'revisar',
      motivos,
    }
  }

  if (hasAnyTerm(haystack, TERMOS_PROTEGIDOS)) {
    motivos.push('Contém termo protegido; não sugerir limpeza automática')
    return {
      categoria: 'possivelmente_importante',
      confianca: 'media',
      preSelecionado: false,
      alertaAnexo,
      sugestao: 'revisar',
      motivos,
    }
  }

  const sinaisPropaganda = [
    /unsubscribe/i,
    /descadastrar/i,
    /newsletter/i,
    /promo[cç][aã]o/i,
    /oferta/i,
    /desconto/i,
    /marketing/i,
    /no-?reply/i,
    /noreply/i,
  ].filter(regex => regex.test(haystack)).length

  if (/(spam|phishing|winner|pr[êe]mio|prize|ganhou|clique urgente|conta bloqueada)/i.test(haystack)) {
    motivos.push('Sinais fortes de spam ou tentativa promocional suspeita')
    return {
      categoria: 'spam_provavel',
      confianca: sinaisPropaganda > 0 ? 'alta' : 'media',
      preSelecionado: sinaisPropaganda > 0 && !alertaAnexo,
      alertaAnexo,
      sugestao: 'candidata_limpeza',
      motivos,
    }
  }

  if (sinaisPropaganda >= 2) {
    motivos.push('Sinais claros de propaganda/newsletter')
    return {
      categoria: 'propaganda_newsletter',
      confianca: 'alta',
      preSelecionado: !alertaAnexo,
      alertaAnexo,
      sugestao: 'candidata_limpeza',
      motivos,
    }
  }

  if (sinaisPropaganda === 1) {
    motivos.push('Sinal isolado de propaganda; revisar antes de qualquer ação')
    return {
      categoria: 'propaganda_newsletter',
      confianca: 'media',
      preSelecionado: false,
      alertaAnexo,
      sugestao: 'revisar',
      motivos,
    }
  }

  if (remetentePareceHumano(from)) {
    motivos.push('Remetente parece pessoa física ou contato humano')
    return {
      categoria: 'possivelmente_importante',
      confianca: 'media',
      preSelecionado: false,
      alertaAnexo,
      sugestao: 'revisar',
      motivos,
    }
  }

  if (message.labelIds?.includes('IMPORTANT') || message.labelIds?.includes('STARRED')) {
    motivos.push('Marcado como importante no Gmail')
    return {
      categoria: 'possivelmente_importante',
      confianca: 'alta',
      preSelecionado: false,
      alertaAnexo,
      sugestao: 'manter',
      motivos,
    }
  }

  motivos.push('Sem classificação automática segura')
  return {
    categoria: 'nao_classificado',
    confianca: 'baixa',
    preSelecionado: false,
    alertaAnexo,
    sugestao: 'revisar',
    motivos,
  }
}

export async function previewGmailCleanup(
  accessToken: string,
  input: GmailCleanupPreviewInput,
): Promise<{ query: string; totalEstimado: number; mensagens: GmailPreviewMessage[] }> {
  const query = buildGmailCleanupQuery(input)
  const maxResults = Math.min(Math.max(input.maxResults ?? 10, 1), 20)
  const search = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  })
  const list = await gmailFetch<GmailListResponse>(accessToken, `/users/me/messages?${search}`)
  const ids = list.messages ?? []

  const mensagens = await Promise.all(ids.map(async item => {
    const params = new URLSearchParams({
      format: 'metadata',
      metadataHeaders: 'From',
    })
    params.append('metadataHeaders', 'Subject')
    params.append('metadataHeaders', 'Date')
    const message = await gmailFetch<GmailGetResponse>(accessToken, `/users/me/messages/${item.id}?${params}`)
    const classificacao = classifyMessage(message, { hasAttachmentQuery: input.comAnexos === true })
    return {
      id: message.id,
      threadId: message.threadId,
      from: header(message.payload?.headers, 'From'),
      subject: header(message.payload?.headers, 'Subject') || '(sem assunto)',
      date: header(message.payload?.headers, 'Date') || null,
      snippet: (message.snippet ?? '').slice(0, 300),
      labelIds: message.labelIds ?? [],
      ...classificacao,
    }
  }))

  return {
    query,
    totalEstimado: list.resultSizeEstimate ?? mensagens.length,
    mensagens,
  }
}
