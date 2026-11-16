// ─────────────────────────────────────────────────────────────────────────────
// CRM Cris e Val — detecção de "módulo ainda não ativado" (migração não aplicada).
//
// Antes de supabase/crm_socios_migration.sql rodar em produção, as tabelas não
// existem. A página mostra o aviso "aguardando ativação" e as APIs respondem 503
// com um código estável, em vez de estourar 500.
// ─────────────────────────────────────────────────────────────────────────────

export interface ErroBanco {
  code?: string | null
  message?: string | null
  details?: string | null
}

/** Código devolvido pelas APIs quando as tabelas ainda não existem. */
export const CODIGO_MODULO_NAO_ATIVADO = 'modulo_nao_ativado'

export const MENSAGEM_MODULO_NAO_ATIVADO =
  'O CRM Cris e Val ainda não foi ativado no banco de dados. Aguarde a ativação.'

/**
 * Identifica o erro de "tabela inexistente":
 *  - PGRST205: PostgREST não achou a tabela no schema cache;
 *  - 42P01: Postgres undefined_table;
 *  - PGRST200: PostgREST não achou o relacionamento (join) com tabela crm_socios_*.
 */
export function ehTabelaAusente(erro: ErroBanco | null | undefined): boolean {
  if (!erro) return false
  const code = erro.code ?? ''
  const msg = `${erro.message ?? ''} ${erro.details ?? ''}`.toLowerCase()
  if (code === 'PGRST205' || code === '42P01') return true
  if (code === 'PGRST200' && msg.includes('crm_socios_')) return true
  // Alguns caminhos devolvem só a mensagem, sem código.
  return msg.includes('crm_socios_') && (msg.includes('schema cache') || msg.includes('does not exist'))
}
