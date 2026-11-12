import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// OAuth 2.1 do conector MCP do PEDV (para o claude.ai, o celular, as tarefas na nuvem e o ChatGPT). O aplicativo se cadastra sozinho
// (DCR), a pessoa entra com o login do PEDV na tela de autorização e o Claude recebe um token curto + um token de
// renovação. Os "clientes" e os tokens de acesso são assinados (HMAC), sem tabela; o que fica no banco são só as
// concessões (mcp_oauth_concessoes), para poder revogar por pessoa. As funções aqui são puras (sem banco).

type Env = Record<string, string | undefined>

const PREFIXO_ACESSO = 'pedvo_'
const PREFIXO_CLIENTE = 'pedvc_'

export const ACESSO_SEGUNDOS = 3600
export const CODIGO_SEGUNDOS = 300
export const RENOVACAO_DIAS = 180

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')
export const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex')
export const segredoAleatorio = (bytes = 32) => randomBytes(bytes).toString('base64url')

function segredo(env: Env): Buffer {
  const base = env.MCP_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Sem segredo para assinar os tokens (defina MCP_TOKEN_SECRET).')
  return createHmac('sha256', base).update('pedv-mcp-oauth-v1').digest()
}

function assinar(payload: string, env: Env) {
  return b64(createHmac('sha256', segredo(env)).update(payload).digest())
}

function conferir(payload: string, sig: string, env: Env): boolean {
  const esperado = createHmac('sha256', segredo(env)).update(payload).digest()
  let recebido: Buffer
  try { recebido = Buffer.from(sig, 'base64url') } catch { return false }
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

// ── Redirecionamentos aceitos ────────────────────────────────────────────────
// Só quem a Valéria liberou pode receber o código de autorização: o Claude (claude.ai/claude.com), o Claude Desktop/Code
// (loopback) e, desde 12/11/2026, o ChatGPT (chatgpt.com, só os dois caminhos de retorno de conectores da OpenAI).
const HOSTS_CLAUDE = ['claude.ai', 'claude.com']
const CHATGPT_RETORNO_FIXO = '/connector_platform_oauth_redirect'
const CHATGPT_RETORNO_POR_ID = /^\/connector\/oauth\/[A-Za-z0-9_-]{1,100}$/

export function redirectUriValido(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 500) return false
  let u: URL
  try { u = new URL(uri) } catch { return false }
  if (u.hash || u.username || u.password) return false
  if (u.protocol === 'https:') {
    if (HOSTS_CLAUDE.includes(u.hostname)) return true
    return u.hostname === 'chatgpt.com' && !u.search && (u.pathname === CHATGPT_RETORNO_FIXO || CHATGPT_RETORNO_POR_ID.test(u.pathname))
  }
  if (u.protocol === 'http:') return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]'
  return false
}

// ── Cliente (cadastro dinâmico, sem tabela) ──────────────────────────────────
export interface ClienteOauth { nome: string; redirectUris: string[] }

export function criarClientId(c: ClienteOauth, env: Env = process.env): string {
  const payload = b64(JSON.stringify({ n: c.nome.slice(0, 80), r: c.redirectUris }))
  return `${PREFIXO_CLIENTE}${payload}.${assinar(payload, env)}`
}

export function lerClientId(clientId: unknown, env: Env = process.env): ClienteOauth | null {
  if (typeof clientId !== 'string' || !clientId.startsWith(PREFIXO_CLIENTE)) return null
  const [payload, sig, ...resto] = clientId.slice(PREFIXO_CLIENTE.length).split('.')
  if (!payload || !sig || resto.length || !conferir(payload, sig, env)) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { n?: string; r?: string[] }
    if (!Array.isArray(d.r) || !d.r.length || !d.r.every(redirectUriValido)) return null
    return { nome: String(d.n ?? 'Claude'), redirectUris: d.r }
  } catch { return null }
}

// ── PKCE (S256) ──────────────────────────────────────────────────────────────
export function pkceConfere(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false
  const esperado = createHash('sha256').update(verifier).digest('base64url')
  const a = Buffer.from(esperado), b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── Token de acesso (curto, assinado; a concessão é conferida no banco a cada chamada) ──
export function gerarTokenAcesso(d: { concessaoId: string; userId: string; clientId: string }, opts: { agora?: number; env?: Env } = {}) {
  const env = opts.env ?? process.env
  const agora = Math.floor((opts.agora ?? Date.now()) / 1000)
  const payload = b64(JSON.stringify({ g: d.concessaoId, u: d.userId, c: d.clientId, e: agora + ACESSO_SEGUNDOS, i: agora }))
  return { token: `${PREFIXO_ACESSO}${payload}.${assinar(payload, env)}`, expiraEm: ACESSO_SEGUNDOS }
}

export const pareceTokenAcesso = (token: string) => token.startsWith(PREFIXO_ACESSO)

export function validarTokenAcesso(token: string, opts: { agora?: number; env?: Env } = {}):
  { ok: true; concessaoId: string; userId: string } | { ok: false; motivo: 'formato' | 'assinatura' | 'expirada' | 'revogada' } {
  const env = opts.env ?? process.env
  const agora = Math.floor((opts.agora ?? Date.now()) / 1000)
  if (!pareceTokenAcesso(token)) return { ok: false, motivo: 'formato' }
  const [payload, sig, ...resto] = token.slice(PREFIXO_ACESSO.length).split('.')
  if (!payload || !sig || resto.length) return { ok: false, motivo: 'formato' }
  if (!conferir(payload, sig, env)) return { ok: false, motivo: 'assinatura' }
  let d: { g?: string; u?: string; e?: number; i?: number }
  try { d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return { ok: false, motivo: 'formato' } }
  if (!d.g || !d.u || typeof d.e !== 'number' || typeof d.i !== 'number') return { ok: false, motivo: 'formato' }
  if (d.e < agora) return { ok: false, motivo: 'expirada' }
  const revogadasAntes = env.MCP_TOKENS_REVOGADOS_ANTES ? Date.parse(env.MCP_TOKENS_REVOGADOS_ANTES) : NaN
  if (!Number.isNaN(revogadasAntes) && d.i * 1000 < revogadasAntes) return { ok: false, motivo: 'revogada' }
  return { ok: true, concessaoId: d.g, userId: d.u }
}

// ── Endereços públicos ───────────────────────────────────────────────────────
/** Origem pública (https://juridico.pessoaedoval.com.br), a mesma que o cliente usou para chegar aqui. */
export const origemPublica = (req: Request) => new URL(req.url).origin

export const urlRecurso = (origem: string) => `${origem}/api/mcp`
export const urlMetadadosRecurso = (origem: string) => `${origem}/.well-known/oauth-protected-resource/api/mcp`

export function metadadosRecurso(origem: string) {
  return {
    resource: urlRecurso(origem),
    authorization_servers: [origem],
    bearer_methods_supported: ['header'],
    resource_name: 'PEDV — Pessoa e do Val Advocacia',
  }
}

export function metadadosServidor(origem: string) {
  return {
    issuer: origem,
    authorization_endpoint: `${origem}/oauth/authorize`,
    token_endpoint: `${origem}/api/oauth/token`,
    registration_endpoint: `${origem}/api/oauth/register`,
    revocation_endpoint: `${origem}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['pedv'],
  }
}

/** Valor do WWW-Authenticate que aponta o Claude para o login (RFC 9728). */
export const desafioBearer = (origem: string, erro?: string) =>
  `Bearer realm="pedv", resource_metadata="${urlMetadadosRecurso(origem)}"${erro ? `, error="${erro}"` : ''}`

// ── Pedido de autorização (vem do Claude na URL de /oauth/authorize) ─────────
export interface PedidoAutorizacao { clientId: string; clienteNome: string; redirectUri: string; state: string; codeChallenge: string }

export function validarPedidoAutorizacao(p: { client_id?: unknown; redirect_uri?: unknown; state?: unknown; code_challenge?: unknown; code_challenge_method?: unknown; response_type?: unknown },
  env: Env = process.env): { ok: true; pedido: PedidoAutorizacao } | { ok: false; erro: string } {
  const cliente = lerClientId(p.client_id, env)
  if (!cliente) return { ok: false, erro: 'Cliente desconhecido. Volte ao Claude e refaça a conexão do conector.' }
  const redirectUri = String(p.redirect_uri ?? '')
  if (!cliente.redirectUris.includes(redirectUri)) return { ok: false, erro: 'Endereço de retorno não confere com o cadastro do aplicativo.' }
  if (p.response_type !== undefined && p.response_type !== 'code') return { ok: false, erro: 'Tipo de resposta não suportado.' }
  const desafio = String(p.code_challenge ?? '')
  if (!/^[A-Za-z0-9_-]{43}$/.test(desafio) || (p.code_challenge_method !== undefined && p.code_challenge_method !== 'S256')) {
    return { ok: false, erro: 'O Claude não enviou a verificação PKCE (S256) exigida.' }
  }
  return { ok: true, pedido: { clientId: String(p.client_id), clienteNome: cliente.nome, redirectUri, state: String(p.state ?? '').slice(0, 500), codeChallenge: desafio } }
}

/** URL de volta ao Claude com o código (ou com o erro), preservando o state. */
export function urlRetorno(redirectUri: string, state: string, extra: Record<string, string>) {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v)
  if (state) u.searchParams.set('state', state)
  return u.toString()
}
