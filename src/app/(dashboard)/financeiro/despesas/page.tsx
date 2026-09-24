import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { podeAcessarDespesas } from '@/lib/auth/despesas-acesso'
import { createClient } from '@/lib/supabase/server'
import DespesasPage from './DespesasPage'

export default async function DespesasRoute() {
  // Tela dedicada e restrita: sócio vê tudo, mais um usuário específico
  // (ex: Célio) liberado só pra despesas — ver src/lib/auth/despesas-acesso.ts.
  const { profile, userId } = await requireAuth()
  if (!podeAcessarDespesas(userId, profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const { data: despesas } = await supabase
    .from('financeiro_lancamentos')
    .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
    .eq('tipo', 'despesa')
    .order('vencimento', { ascending: false })
    .limit(500)

  return (
    <div className="internal-page">
      <DespesasPage
        despesas={(despesas ?? []) as any}
        podeExcluir={profile.role === 'socio'}
      />
    </div>
  )
}
