import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import FinanceiroPage from './FinanceiroPage'

export default async function FinanceiroRoute() {
  // Apenas sócios acessam o financeiro — alinhado com proxy RESTRICTED e ALLOWED_ROUTES.
  // O proxy já bloqueia outros roles, mas requireRole adiciona defense-in-depth.
  const { profile } = await requireRole(['socio'])
  const supabase = await createClient()

  const [{ data: lancamentos }, { data: profilesFuncionarios }, { data: salarios }] = await Promise.all([
    supabase
      .from('financeiro_lancamentos')
      .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
      .order('vencimento', { ascending: false })
      .limit(500),
    // Todo mundo que recebe salário: todos os papéis, menos sócio (ver funcionarios_salarios).
    supabase
      .from('profiles')
      .select('id, nome, email, role')
      .eq('ativo', true)
      .neq('role', 'socio')
      .order('role')
      .order('nome'),
    supabase
      .from('funcionarios_salarios')
      .select('profile_id, valor_salario, dia_pagamento, forma_pagamento, observacoes, updated_at'),
  ])

  const salarioPorProfile = new Map((salarios ?? []).map(s => [s.profile_id, s]))
  const funcionarios = (profilesFuncionarios ?? []).map(p => {
    const s = salarioPorProfile.get(p.id)
    return {
      profile_id:      p.id,
      nome:            p.nome,
      email:           p.email,
      role:            p.role,
      valor_salario:   s?.valor_salario   ?? null,
      dia_pagamento:   s?.dia_pagamento   ?? null,
      forma_pagamento: s?.forma_pagamento ?? null,
      observacoes:     s?.observacoes     ?? null,
      updated_at:      s?.updated_at      ?? null,
    }
  })

  return (
    <div className="internal-page">
      <FinanceiroPage
        lancamentos={(lancamentos ?? []) as any}
        funcionarios={funcionarios as any}
        role={profile.role}
      />
    </div>
  )
}
