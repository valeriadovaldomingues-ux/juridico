import { createClient } from '@/lib/supabase/server'

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

    const ip = params.request
      ? (params.request.headers.get('x-forwarded-for') ?? params.request.headers.get('x-real-ip') ?? null)
      : null

    const userAgent = params.request
      ? params.request.headers.get('user-agent')
      : null

    await supabase.from('portal_access_logs').insert({
      user_id:     params.userId,
      cliente_id:  params.clienteId,
      acao:        params.acao,
      resource_id: params.resourceId ?? null,
      detalhes:    params.detalhes   ?? null,
      ip_address:  ip,
      user_agent:  userAgent,
    })
  } catch {
    // Log silencioso — não propaga o erro
  }
}
