import {
  ACESSO_SEGUNDOS, CODIGO_SEGUNDOS, RENOVACAO_DIAS,
  gerarTokenAcesso, pkceConfere, segredoAleatorio, sha256Hex,
} from './oauth'

// Concessões do OAuth do conector (tabela mcp_oauth_concessoes): uma por login autorizado ("Claude do Fulano no navegador").
// Guardam só o hash do código e dos tokens de renovação. Revogar = preencher revogado_em; vale na próxima chamada.

type Db = { from: (t: string) => any }  // eslint-disable-line @typescript-eslint/no-explicit-any

const TABELA = 'mcp_oauth_concessoes'
const iso = (ms: number) => new Date(ms).toISOString()
const USO_A_CADA_MS = 10 * 60_000

export type ErroToken = { erro: 'invalid_grant' | 'invalid_request' | 'server_error'; descricao: string }
export interface TokensEmitidos { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string }

/** Registra a autorização da pessoa e devolve o código (uso único, 5 min) que o Claude troca por tokens. */
export async function criarConcessao(db: Db, d: {
  userId: string; clientId: string; clientNome: string; redirectUri: string; codeChallenge: string; agora?: number
}): Promise<{ codigo: string } | { erro: string }> {
  const agora = d.agora ?? Date.now()
  const codigo = segredoAleatorio()
  const { error } = await db.from(TABELA).insert({
    user_id: d.userId, client_id: d.clientId, client_nome: d.clientNome, redirect_uri: d.redirectUri,
    code_challenge: d.codeChallenge, code_hash: sha256Hex(codigo), code_expira_em: iso(agora + CODIGO_SEGUNDOS * 1000),
  })
  if (error) return { erro: error.message }
  return { codigo }
}

function emitir(concessaoId: string, userId: string, clientId: string, agora: number) {
  const refresh = segredoAleatorio()
  const acesso = gerarTokenAcesso({ concessaoId, userId, clientId }, { agora })
  const tokens: TokensEmitidos = { access_token: acesso.token, token_type: 'Bearer', expires_in: ACESSO_SEGUNDOS, refresh_token: refresh, scope: 'pedv' }
  return { tokens, refreshHash: sha256Hex(refresh), refreshExpira: iso(agora + RENOVACAO_DIAS * 86400_000) }
}

/** Troca o código de autorização (com PKCE) pelo primeiro par de tokens. O código é queimado mesmo se algo não bater. */
export async function trocarCodigo(db: Db, d: { codigo: string; clientId: string; redirectUri: string; codeVerifier: string; agora?: number }):
  Promise<{ tokens: TokensEmitidos } | ErroToken> {
  const agora = d.agora ?? Date.now()
  const { data: c, error } = await db.from(TABELA)
    .update({ code_hash: null, code_expira_em: null })
    .eq('code_hash', sha256Hex(d.codigo)).gt('code_expira_em', iso(agora)).is('revogado_em', null)
    .select('id, user_id, client_id, redirect_uri, code_challenge').maybeSingle()
  if (error) return { erro: 'server_error', descricao: 'Não foi possível validar o código.' }
  if (!c) return { erro: 'invalid_grant', descricao: 'Código inválido, expirado ou já usado.' }
  if (c.client_id !== d.clientId || c.redirect_uri !== d.redirectUri) return { erro: 'invalid_grant', descricao: 'Código emitido para outro cliente ou endereço.' }
  if (!pkceConfere(d.codeVerifier, c.code_challenge)) return { erro: 'invalid_grant', descricao: 'Verificação PKCE falhou.' }

  const e = emitir(c.id, c.user_id, c.client_id, agora)
  const { error: errUp } = await db.from(TABELA)
    .update({ refresh_hash: e.refreshHash, refresh_expira_em: e.refreshExpira, ultimo_uso_em: iso(agora) }).eq('id', c.id)
  if (errUp) return { erro: 'server_error', descricao: 'Não foi possível emitir os tokens.' }
  return { tokens: e.tokens }
}

/** Renova o acesso com o token de renovação (que é trocado por um novo; o anterior segue valendo uma vez, caso a resposta se perca). */
export async function renovar(db: Db, d: { refreshToken: string; clientId: string; agora?: number }):
  Promise<{ tokens: TokensEmitidos } | ErroToken> {
  const agora = d.agora ?? Date.now()
  const h = sha256Hex(d.refreshToken)
  const { data: c, error } = await db.from(TABELA)
    .select('id, user_id, client_id, refresh_hash, refresh_expira_em')
    .or(`refresh_hash.eq.${h},refresh_hash_anterior.eq.${h}`).is('revogado_em', null).maybeSingle()
  if (error) return { erro: 'server_error', descricao: 'Não foi possível validar o token.' }
  if (!c || c.client_id !== d.clientId || !c.refresh_expira_em || Date.parse(c.refresh_expira_em) < agora) {
    return { erro: 'invalid_grant', descricao: 'Token de renovação inválido, expirado ou revogado.' }
  }
  const e = emitir(c.id, c.user_id, c.client_id, agora)
  const { error: errUp } = await db.from(TABELA)
    .update({ refresh_hash: e.refreshHash, refresh_hash_anterior: c.refresh_hash, refresh_expira_em: e.refreshExpira, ultimo_uso_em: iso(agora) })
    .eq('id', c.id)
  if (errUp) return { erro: 'server_error', descricao: 'Não foi possível renovar o token.' }
  return { tokens: e.tokens }
}

/** A concessão do token de acesso ainda vale (não foi revogada)? Registra o último uso (no máximo a cada 10 min). */
export async function concessaoAtiva(db: Db, concessaoId: string, userId: string, agora = Date.now()): Promise<boolean> {
  const { data: c } = await db.from(TABELA).select('user_id, revogado_em, ultimo_uso_em').eq('id', concessaoId).maybeSingle()
  if (!c || c.revogado_em || c.user_id !== userId) return false
  if (!c.ultimo_uso_em || agora - Date.parse(c.ultimo_uso_em) > USO_A_CADA_MS) {
    await db.from(TABELA).update({ ultimo_uso_em: iso(agora) }).eq('id', concessaoId)
  }
  return true
}

/** RFC 7009: revoga a concessão do token de renovação informado. Sempre "sucesso" para quem chama. */
export async function revogarPorRenovacao(db: Db, refreshToken: string, agora = Date.now()) {
  const h = sha256Hex(refreshToken)
  await db.from(TABELA).update({ revogado_em: iso(agora) })
    .or(`refresh_hash.eq.${h},refresh_hash_anterior.eq.${h}`).is('revogado_em', null)
}
