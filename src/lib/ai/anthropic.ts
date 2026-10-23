// Provedor Claude (Anthropic) para a camada de IA. Usa a API Messages direto (sem SDK extra).
// Ligado por ANTHROPIC_API_KEY (ou AI_PROVIDER=anthropic). Modelo: ANTHROPIC_MODEL (padrão claude-haiku-5-5, o mais barato;
// para peças mais elaboradas, use claude-sonnet-5-5). AI_PROVIDER=openai força a OpenAI mesmo com a chave da Anthropic.

export const ANTHROPIC_MODELO_PADRAO = 'claude-haiku-5-5'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export interface MensagemIA { role: string; content?: unknown }

type Env = Record<string, string | undefined>

export function usaAnthropic(env: Env = process.env): boolean {
  if (env.AI_PROVIDER === 'openai') return false
  return env.AI_PROVIDER === 'anthropic' || !!env.ANTHROPIC_API_KEY
}

export function modeloAnthropic(env: Env = process.env): string {
  return env.ANTHROPIC_MODEL || ANTHROPIC_MODELO_PADRAO
}

const textoDe = (c: unknown): string =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : '')).join('') : ''

/** Mensagens no formato OpenAI → `system` + mensagens user/assistant da Anthropic (junta mensagens seguidas do mesmo papel). */
export function paraMensagensAnthropic(mensagens: MensagemIA[]): { system: string; messages: { role: 'user' | 'assistant'; content: string }[] } {
  const system: string[] = []
  const saida: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of mensagens) {
    const texto = textoDe(m.content)
    if (m.role === 'system' || m.role === 'developer') { if (texto) system.push(texto); continue }
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    const ultimo = saida[saida.length - 1]
    if (ultimo && ultimo.role === role) ultimo.content += `\n\n${texto}`
    else saida.push({ role, content: texto })
  }
  if (saida.length === 0 || saida[0].role !== 'user') saida.unshift({ role: 'user', content: '(início da conversa)' })
  return { system: system.join('\n\n'), messages: saida }
}

/** O Claude não tem "modo JSON": tira cercas ```json e texto em volta, devolvendo só o objeto {...}. */
export function extrairJSON(texto: string): string {
  const limpo = texto.replace(/```(?:json)?/gi, '').trim()
  const ini = limpo.indexOf('{')
  const fim = limpo.lastIndexOf('}')
  return ini >= 0 && fim > ini ? limpo.slice(ini, fim + 1) : '{}'
}

export class ErroAnthropic extends Error {
  status: number
  code?: string
  type?: string
  constructor(status: number, mensagem: string, type?: string) {
    super(mensagem)
    this.status = status
    this.type = type
    if (/credit balance is too low|insufficient.*credit/i.test(mensagem)) this.code = 'credit_balance_exhausted'
  }
}

function chave(env: Env = process.env): string {
  const k = env.ANTHROPIC_API_KEY ?? env.AI_API_KEY
  if (!k) throw new Error('ANTHROPIC_API_KEY não configurada. Adicione nas variáveis de ambiente (Vercel) e faça um novo deploy.')
  return k
}

async function chamar(corpo: Record<string, unknown>): Promise<Response> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': chave(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => null) as { error?: { type?: string; message?: string } } | null
    throw new ErroAnthropic(res.status, j?.error?.message ?? `Erro ${res.status} na API da Anthropic`, j?.error?.type)
  }
  return res
}

function corpoBase(mensagens: MensagemIA[], opts: { maxTokens: number; temperature?: number; json?: boolean }) {
  const { system, messages } = paraMensagensAnthropic(mensagens)
  const reforco = opts.json ? '\n\nResponda SOMENTE com um objeto JSON válido, sem nenhum texto antes ou depois e sem cercas de código.' : ''
  return {
    model: modeloAnthropic(),
    max_tokens: opts.maxTokens,
    ...(opts.temperature !== undefined ? { temperature: Math.min(1, opts.temperature) } : {}),
    ...((system || reforco) ? { system: `${system}${reforco}`.trim() } : {}),
    messages,
  }
}

export async function anthropicCompletar(mensagens: MensagemIA[], opts: { maxTokens: number; temperature?: number; json?: boolean }): Promise<string> {
  const res = await chamar(corpoBase(mensagens, opts))
  const j = await res.json() as { content?: { type: string; text?: string }[] }
  const texto = (j.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('')
  return opts.json ? extrairJSON(texto) : texto
}

/** Texto de um evento SSE `content_block_delta`, ou '' para qualquer outro. */
export function textoDoEvento(linha: string): string {
  if (!linha.startsWith('data:')) return ''
  try {
    const e = JSON.parse(linha.slice(5).trim()) as { type?: string; delta?: { type?: string; text?: string } }
    return e.type === 'content_block_delta' && e.delta?.type === 'text_delta' ? e.delta.text ?? '' : ''
  } catch { return '' }
}

/** Abre o stream já checando erro de chave/crédito antes de devolver (o chamador mostra a mensagem legível). */
export async function anthropicStream(mensagens: MensagemIA[], opts: { maxTokens: number; temperature?: number }): Promise<ReadableStream<Uint8Array>> {
  const res = await chamar({ ...corpoBase(mensagens, opts), stream: true })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const leitor = res.body!.getReader()
  let resto = ''
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await leitor.read()
      if (done) { controller.close(); return }
      resto += decoder.decode(value, { stream: true })
      const linhas = resto.split('\n')
      resto = linhas.pop() ?? ''
      for (const l of linhas) {
        const t = textoDoEvento(l)
        if (t) controller.enqueue(encoder.encode(t))
      }
    },
    cancel() { return leitor.cancel() },
  })
}
