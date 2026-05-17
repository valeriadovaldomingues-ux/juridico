import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import FinanceiroPage from './FinanceiroPage'

export default async function FinanceiroRoute() {
  // Apenas sócios acessam o financeiro — alinhado com proxy RESTRICTED e ALLOWED_ROUTES.
  // O proxy já bloqueia outros roles, mas requireRole adiciona defense-in-depth.
  const { profile } = await requireRole(['socio'])
  const supabase = await createClient()

  const [
    { data: lancamentos },
    { data: clientes },
    { data: processos },
  ] = await Promise.all([
    supabase
      .from('financeiro_lancamentos')
      .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
      .order('vencimento', { ascending: false })
      .limit(500),
    supabase
      .from('clientes')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('processos')
      .select('id, numero_processo, titulo')
      .in('status', ['ativo', 'suspenso'])
      .order('titulo'),
  ])

  return (
    <FinanceiroPage
      lancamentos={(lancamentos ?? []) as any}
      clientes={(clientes ?? []) as any}
      processos={(processos ?? []) as any}
      role={profile.role}
    />
  )
}
