import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import FinanceiroPage from './FinanceiroPage'

export default async function FinanceiroRoute() {
  // Apenas sócios acessam o financeiro — alinhado com proxy RESTRICTED e ALLOWED_ROUTES.
  // O proxy já bloqueia outros roles, mas requireRole adiciona defense-in-depth.
  const { profile } = await requireRole(['socio'])
  const supabase = await createClient()

  const { data: lancamentos } = await supabase
    .from('financeiro_lancamentos')
    .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
    .order('vencimento', { ascending: false })
    .limit(500)

  return (
    <div className="internal-page">
      <FinanceiroPage
        lancamentos={(lancamentos ?? []) as any}
        role={profile.role}
      />
    </div>
  )
}
