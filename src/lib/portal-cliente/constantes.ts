// Constantes do Portal do Cliente v2 (CPF/CNPJ + código de 6 dígitos).
// Arquivo sem dependências de servidor (usado também pelo proxy e por telas).

/** Cookie da sessão própria do portal (token opaco; no banco fica só o hash). */
export const COOKIE_SESSAO = 'pv_portal_sessao'

/** Sessão do cliente: 12 h, revogável. */
export const SESSAO_DURACAO_MS = 12 * 60 * 60 * 1000

/** "Ver como cliente" (visualização do sócio): 30 min, só leitura, marcada no user_agent da sessão com o id de quem abriu. */
export const PREVIA_DURACAO_MS = 30 * 60 * 1000
export const PREFIXO_PREVIA = 'previa-socio:'

/** Código de acesso: 10 min, uso único, no máximo 5 tentativas. */
export const CODIGO_VALIDADE_MS = 10 * 60 * 1000
export const CODIGO_MAX_TENTATIVAS = 5

/** Tempo mínimo de resposta das rotas de login (mitiga enumeração por tempo). */
export const TEMPO_MINIMO_LOGIN_MS = 800

/**
 * Quem GERENCIA o portal no escritório: fila de pedidos de acesso, bloco "Acesso ao portal" na ficha do cliente
 * (liberar, revogar, encerrar sessões) e o interruptor "Ocultar do portal" na ficha do processo.
 * Por decisão da sócia, por enquanto só o sócio. Para ampliar depois, basta incluir papéis aqui.
 */
export const PORTAL_PAPEIS_GESTAO: string[] = ['socio']

export function podeGerenciarPortal(role: string | null | undefined): boolean {
  return !!role && PORTAL_PAPEIS_GESTAO.includes(role)
}

/** Rotas públicas do portal (sem cookie de sessão). */
export const ROTA_LOGIN_PORTAL = '/portal/login'
export const PREFIXO_API_AUTH_PORTAL = '/api/portal/auth/'
