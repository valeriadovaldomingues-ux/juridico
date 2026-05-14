import { createClient } from '@/lib/supabase/server'
import { extractIP, truncateUserAgent, isUUID } from '@/lib/portal/validate'

export type PortalAcao =
  | 'login'
  | 'view_processo'
  | 'view_agenda'
  | 'view_documento'
  | 'download_documento'
  | 'send_message'
  | 'view_mensagens'
  | 'view_perfil'

/**
 * Registra uma ação do cliente no portal.
 * Falhas são silenciosas — nunca devem bloquear a resposta ao usuário.
 * IP lido de headers confiáveis; user-agent truncado a 512 chars.
 */
export async function logPortalAccess(params: {
  userId:     string
  clienteId:  string
  acao:       PortalAcao
  resourceId?: string
  detalhes?:   Record<string, unknown>
  request?:    Request
}): Promise<void> {
  try {
    const supabase = await createClient()

    const ip        = params.request ? extractIP(params.request)        : null
    const userAgent = params.request
      ? truncateUserAgent(params.request.headers.get('user-agent'))
      : null

    // Garante que resourceId é um UUID válido antes de persistir
    const resourceId = params.resourceId && isUUID(params.resourceId)
      ? params.resourceId
      : null

    await supabase.from('portal_access_logs').insert({
      user_id:     params.userId,
      cliente_id:  params.clienteId,
      acao:        params.acao,
      resource_id: resourceId,
      detalhes:    params.detalhes ?? null,
      ip_address:  ip,
      user_agent:  userAgent,
    })
  } catch {
    // Log silencioso — não propaga o erro
  }
}
