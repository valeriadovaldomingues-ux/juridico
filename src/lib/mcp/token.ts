import { createHmac, timingSafeEqual } from 'node:crypto'

// Chave pessoal para ligar o Claude de um advogado ao PEDV (conector MCP). É um token assinado (HMAC), sem tabela:
// leva o id do usuário e a data de validade. O segredo vem de MCP_TOKEN_SECRET (ou, se não houver, é derivado da chave
// de serviço). Para invalidar TODAS as chaves já emitidas: troque MCP_TOKEN_SECRET ou defina MCP_TOKENS_REVOGADOS_ANTES
// com uma data (chaves emitidas antes dela deixam de valer).

const PREFIXO = 'pedv_'
type Env = Record<string, string | undefined>

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

function segredo(env: Env): Buffer {
  const base = env.MCP_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Sem segredo para assinar a chave (defina MCP_TOKEN_SECRET).')
  return createHmac('sha256', base).update('pedv-mcp-v1').digest()
}

export function gerarToken(userId: string, opts: { dias?: number; agora?: number; env?: Env } = {}): { token: string; expiraEm: Date } {
  const env = opts.env ?? process.env
  const agora = opts.agora ?? Date.now()
  const exp = Math.floor(agora / 1000) + (opts.dias ?? 90) * 86400
  const payload = b64(JSON.stringify({ u: userId, e: exp, i: Math.floor(agora / 1000) }))
  const sig = b64(createHmac('sha256', segredo(env)).update(payload).digest())
  return { token: `${PREFIXO}${payload}.${sig}`, expiraEm: new Date(exp * 1000) }
}

export function validarToken(token: string, opts: { agora?: number; env?: Env } = {}):
  { ok: true; userId: string } | { ok: false; motivo: 'formato' | 'assinatura' | 'expirada' | 'revogada' } {
  const env = opts.env ?? process.env
  const agora = Math.floor((opts.agora ?? Date.now()) / 1000)
  if (!token.startsWith(PREFIXO)) return { ok: false, motivo: 'formato' }
  const [payload, sig, ...resto] = token.slice(PREFIXO.length).split('.')
  if (!payload || !sig || resto.length) return { ok: false, motivo: 'formato' }

  const esperado = createHmac('sha256', segredo(env)).update(payload).digest()
  let recebido: Buffer
  try { recebido = Buffer.from(sig, 'base64url') } catch { return { ok: false, motivo: 'formato' } }
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return { ok: false, motivo: 'assinatura' }

  let dados: { u?: string; e?: number; i?: number }
  try { dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return { ok: false, motivo: 'formato' } }
  if (!dados.u || typeof dados.e !== 'number' || typeof dados.i !== 'number') return { ok: false, motivo: 'formato' }
  if (dados.e < agora) return { ok: false, motivo: 'expirada' }
  const revogadasAntes = env.MCP_TOKENS_REVOGADOS_ANTES ? Date.parse(env.MCP_TOKENS_REVOGADOS_ANTES) : NaN
  if (!Number.isNaN(revogadasAntes) && dados.i * 1000 < revogadasAntes) return { ok: false, motivo: 'revogada' }
  return { ok: true, userId: dados.u }
}
