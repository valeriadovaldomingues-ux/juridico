/**
 * Logger centralizado para eventos de segurança do portal.
 *
 * Formato: JSON estruturado em stderr (console.warn).
 * Compatível com Edge Runtime, Node.js e Vercel Log Drains.
 *
 * Tipos de evento:
 *   csrf_block     — request bloqueado por Origin inválido
 *   rate_limit     — request bloqueado por excesso de frequência
 *   orphan_session — usuário autenticado sem profile no banco
 *   invalid_uuid   — parâmetro recebido com formato UUID inválido
 *   abuse_attempt  — padrão de comportamento abusivo detectado
 *
 * Dados que NUNCA devem aparecer nos logs:
 *   - endereços de email
 *   - conteúdo de mensagens
 *   - tokens de sessão
 *   - nomes de arquivos de documentos
 */

export type SecurityEventType =
  | 'csrf_block'
  | 'rate_limit'
  | 'orphan_session'
  | 'invalid_uuid'
  | 'abuse_attempt'

export interface SecurityLogEntry {
  type:      SecurityEventType
  endpoint:  string
  ip?:       string | null
  userId?:   string
  detail?:   string
}

/**
 * Emite um evento de segurança com timestamp ISO e source padronizados.
 * Silencioso em test — evita poluir output de testes.
 */
export function logSecurity(entry: SecurityLogEntry): void {
  if (process.env.NODE_ENV === 'test') return

  const payload = {
    source:   'portal:security',
    ts:       new Date().toISOString(),
    type:     entry.type,
    endpoint: entry.endpoint,
    ...(entry.ip     ? { ip:     entry.ip     } : {}),
    ...(entry.userId ? { userId: entry.userId } : {}),
    ...(entry.detail ? { detail: entry.detail } : {}),
  }

  console.warn(JSON.stringify(payload))
}
