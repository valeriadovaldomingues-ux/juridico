import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service_role key.
 * Usado exclusivamente em API routes (server-side) para operações administrativas
 * como criar usuários via auth.admin.
 *
 * NUNCA importe este módulo em código client-side.
 *
 * Requer a variável de ambiente SUPABASE_SERVICE_ROLE_KEY no .env.local.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não está definida. ' +
      'Adicione-a ao .env.local para habilitar a gestão de usuários.'
    )
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
