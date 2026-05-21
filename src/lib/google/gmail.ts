export interface GmailCleanupPreviewInput {
  remetente?: string
  assunto?: string
  palavraChave?: string
  anteriorA?: string
  posteriorA?: string
  comAnexos?: boolean
  maxResults?: number
}

export interface GmailPreviewMessage {
  id: string
  threadId: string
  from: string
  subject: string
  date: string | null
  snippet: string
  labelIds: string[]
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

function classifyMessage(message: GmailGetResponse): Pick<GmailPreviewMessage, 'sugestao' | 'motivos'> {
  const subject = header(message.payload?.headers, 'Subject')
  const from = header(message.payload?.headers, 'From')
  const snippet = message.snippet ?? ''
  const haystack = `${subject} ${from} ${snippet}`.toLowerCase()
  const motivos: string[] = []

  if (/(intima[cç][aã]o|publica[cç][aã]o|dje|djen|di[aá]rio|pje|prazo|audi[eê]ncia|tribunal|comunica[cç][aã]o processual)/i.test(haystack)) {
    motivos.push('Possível comunicação processual ou publicação')
    return { sugestao: 'candidata_publicacao', motivos }
  }

  if (/(newsletter|promo[cç][aã]o|marketing|unsubscribe|descadastrar|oferta|webinar)/i.test(haystack)) {
    motivos.push('Possível item promocional ou informativo')
    return { sugestao: 'candidata_limpeza', motivos }
  }

  if (message.labelIds?.includes('IMPORTANT') || message.labelIds?.includes('STARRED')) {
    motivos.push('Marcado como importante no Gmail')
    return { sugestao: 'manter', motivos }
  }

  motivos.push('Sem classificação automática segura')
  return { sugestao: 'revisar', motivos }
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
    const classificacao = classifyMessage(message)
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
