import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createClient as svcClient }  from '@supabase/supabase-js'

let _svc: ReturnType<typeof svcClient> | null = null
function getServiceClient() {
  if (_svc) return _svc
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _svc = svcClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _svc
}
import ComercialPage from './ComercialPage'

export const metadata = { title: 'Comercial — PEDV' }

export default async function Page() {
  // 'comercial' incluído — este role tem acesso completo ao módulo CRM/funil.
  // Sincronizado com ALLOWED_ROUTES[comercial] e PERMISSIONS[comercial].comercial.
  const { profile } = await requireRole(['comercial', 'administrativo', 'socio'])

  const supabase = await createClient()

  const [{ data: leads }, { data: profiles }, { data: reunioesPendentes }] = await Promise.all([
    supabase
      .from('leads')
      .select(`
        *,
        responsavel:profiles!responsavel_id(id, nome, cor_kanban),
        cliente:clientes!cliente_id(id, nome)
      `)
      .order('ordem')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, nome, cor_kanban, role')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('agenda_items')
      .select('id, titulo, data_inicio')
      .eq('tipo', 'reuniao')
      .eq('status', 'pendente')
      .gte('data_inicio', new Date().toISOString().split('T')[0])
      .order('data_inicio'),
  ])

  return (
    <ComercialPage
      initialLeads={leads ?? []}
      profiles={profiles ?? []}
      currentUserId={profile.id}
      reunioesPendentes={reunioesPendentes?.length ?? 0}
    />
  )
}
