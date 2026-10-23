// ─── Notificações reutilizáveis ──────────────────────────────────────────────
//
// A RLS de `notifications` só permite que cada usuário manipule as próprias
// linhas (user_id = auth.uid()), então a criação para terceiros usa o client
// de service role — mesmo padrão de src/lib/auth/api-guard.ts.
//
// Evita duplicidade: com `dedupe: true` (padrão), não recria uma notificação
// não lida com o mesmo título e link no mesmo dia.

import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

let serviceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  }
  return serviceClient
}

export interface NovaNotificacao {
  title: string
  message: string
  type?: 'info' | 'warning' | 'critical' | 'success'
  link?: string
}

export interface OpcoesNotificacao {
  dedupe?: boolean
  client?: SupabaseClient
}

export async function notificarUsuarios(
  userIds: string[],
  notif: NovaNotificacao,
  opcoes: OpcoesNotificacao = {},
): Promise<number> {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return 0

  const sb = opcoes.client ?? getServiceClient()
  let destinatarios = ids

  if (opcoes.dedupe !== false) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const { data: existentes } = await sb
      .from('notifications')
      .select('user_id')
      .in('user_id', ids)
      .eq('title', notif.title)
      .eq('is_read', false)
      .gte('created_at', hoje.toISOString())
    const jaNotificados = new Set((existentes ?? []).map(item => item.user_id as string))
    destinatarios = ids.filter(id => !jaNotificados.has(id))
  }

  if (destinatarios.length === 0) return 0

  const { error } = await sb.from('notifications').insert(
    destinatarios.map(user_id => ({
      user_id,
      title: notif.title,
      message: notif.message,
      type: notif.type ?? 'info',
      link: notif.link ?? null,
    })),
  )

  if (error) {
    console.warn('[notificacoes] Falha ao criar notificações:', error.message)
    return 0
  }
  return destinatarios.length
}

export async function notificarRoles(
  roles: UserRole[],
  notif: NovaNotificacao,
  opcoes: OpcoesNotificacao = {},
): Promise<number> {
  const sb = opcoes.client ?? getServiceClient()
  const { data: perfis, error } = await sb
    .from('profiles')
    .select('id')
    .in('role', roles)
    .eq('ativo', true)

  if (error || !perfis?.length) return 0
  return notificarUsuarios(perfis.map(p => p.id as string), notif, { ...opcoes, client: sb })
}
