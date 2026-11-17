// Sessão própria do portal (sem Supabase Auth): cookie com token opaco de 32 bytes; no banco só o sha256.

import type { Db } from './db'
import { checar } from './db'
import { resumirIp, resumirUserAgent, sha256, tokenAleatorio } from './segredos'
import { PREFIXO_PREVIA, PREVIA_DURACAO_MS, SESSAO_DURACAO_MS } from './constantes'

export interface SessaoPortal {
  sessaoId: string
  clienteId: string
  clienteNome: string
  /** true = visualização "Ver como cliente" aberta por um sócio (não é o cliente de verdade). */
  previa: boolean
}

export async function criarSessao(
  db: Db,
  clienteId: string,
  contexto: { ip?: string | null; userAgent?: string | null } = {},
  agora: Date = new Date(),
): Promise<{ token: string; expiraEm: Date }> {
  const token = tokenAleatorio(32)
  const expiraEm = new Date(agora.getTime() + SESSAO_DURACAO_MS)
  const { error } = await db.from('portal_sessoes').insert({
    token_hash: sha256(token),
    cliente_id: clienteId,
    criado_em: agora.toISOString(),
    expira_em: expiraEm.toISOString(),
    ip_resumo: resumirIp(contexto.ip),
    // O prefixo de prévia é reservado ao servidor: um navegador que mande esse texto não vira "visualização" (e não esconde logs).
    user_agent: resumirUserAgent(contexto.userAgent?.startsWith(PREFIXO_PREVIA) ? `_${contexto.userAgent}` : contexto.userAgent),
  })
  checar(error, 'sessoes')
  return { token, expiraEm }
}

/**
 * Sessão de VISUALIZAÇÃO para o sócio ver o portal como o cliente vê, sem código. Curta (30 min), marcada com o id de quem abriu
 * (aparece na faixa do portal e no log). Só vale enquanto o acesso do cliente estiver liberado, como qualquer sessão.
 */
export async function criarSessaoPrevia(db: Db, clienteId: string, usuarioId: string, agora: Date = new Date()): Promise<{ token: string; expiraEm: Date }> {
  const token = tokenAleatorio(32)
  const expiraEm = new Date(agora.getTime() + PREVIA_DURACAO_MS)
  const { error } = await db.from('portal_sessoes').insert({
    token_hash: sha256(token),
    cliente_id: clienteId,
    criado_em: agora.toISOString(),
    expira_em: expiraEm.toISOString(),
    ip_resumo: null,
    user_agent: `${PREFIXO_PREVIA}${usuarioId}`,
  })
  checar(error, 'sessoes')
  return { token, expiraEm }
}

/**
 * Valida o token do cookie. Só aceita sessão existente, não revogada e não expirada, de um cliente ativo
 * cujo acesso ao portal não tenha sido revogado. Qualquer falha devolve null.
 */
export async function validarToken(db: Db, token: string | null | undefined, agora: Date = new Date()): Promise<SessaoPortal | null> {
  if (!token || token.length < 20 || token.length > 200) return null
  const { data: s, error } = await db
    .from('portal_sessoes')
    .select('id, cliente_id, expira_em, revogada_em, user_agent')
    .eq('token_hash', sha256(token))
    .maybeSingle()
  checar(error, 'sessoes')
  if (!s || s.revogada_em || new Date(s.expira_em as string).getTime() <= agora.getTime()) return null

  const { data: acesso } = await db.from('portal_acessos').select('ativo').eq('cliente_id', s.cliente_id as string).maybeSingle()
  // Modo piloto: sem liberação ativa não há sessão válida.
  if (!acesso || acesso.ativo !== true) return null

  const { data: cliente } = await db.from('clientes').select('id, nome, ativo').eq('id', s.cliente_id as string).maybeSingle()
  if (!cliente || cliente.ativo === false) return null

  return { sessaoId: s.id as string, clienteId: cliente.id as string, clienteNome: (cliente.nome as string) ?? '', previa: typeof s.user_agent === 'string' && s.user_agent.startsWith(PREFIXO_PREVIA) }
}

export async function revogarToken(db: Db, token: string | null | undefined, agora: Date = new Date()): Promise<void> {
  if (!token) return
  await db.from('portal_sessoes').update({ revogada_em: agora.toISOString() }).eq('token_hash', sha256(token)).is('revogada_em', null)
}

export async function revogarSessoesDoCliente(db: Db, clienteId: string, agora: Date = new Date()): Promise<number> {
  const { data, error } = await db
    .from('portal_sessoes')
    .update({ revogada_em: agora.toISOString() })
    .eq('cliente_id', clienteId)
    .is('revogada_em', null)
    .select('id')
  checar(error, 'sessoes')
  return data?.length ?? 0
}

export function opcoesCookie(expiraEm: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiraEm,
  }
}
