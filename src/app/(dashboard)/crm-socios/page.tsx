import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { CRM_SOCIOS_PAPEIS, CRM_SOCIOS_RESPONSAVEL_PAPEIS, TABELA_OPORTUNIDADES } from '@/lib/crm-socios/constants'
import { ehTabelaAusente } from '@/lib/crm-socios/modulo'
import { SELECT_OPORTUNIDADE } from '@/lib/crm-socios/api'
import type { CrmOportunidade, CrmPerfilSocio } from '@/types/crm-socios'
import CrmSociosPage from './CrmSociosPage'
import { AvisoAguardandoAtivacao, AvisoErroCarregamento } from './Avisos'

export const metadata = { title: 'CRM Cris e Val — PEDV' }

export default async function Page() {
  // Só sócios (Valéria e Cristiano). Quem não é sócio cai no /dashboard (e o proxy já barra antes).
  const { profile } = await requireRole([...CRM_SOCIOS_PAPEIS])

  const supabase = await createClient()

  const [oportunidades, perfis] = await Promise.all([
    supabase
      .from(TABELA_OPORTUNIDADES)
      .select(SELECT_OPORTUNIDADE)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, nome, cor_kanban')
      .eq('ativo', true)
      .in('role', [...CRM_SOCIOS_RESPONSAVEL_PAPEIS])
      .order('nome'),
  ])

  // Migração ainda não aplicada: aviso em vez de erro 500.
  if (oportunidades.error && ehTabelaAusente(oportunidades.error)) {
    return (
      <div className="internal-page">
        <AvisoAguardandoAtivacao />
      </div>
    )
  }
  if (oportunidades.error) {
    return (
      <div className="internal-page">
        <AvisoErroCarregamento />
      </div>
    )
  }

  return (
    <div className="internal-page">
      <CrmSociosPage
        oportunidadesIniciais={(oportunidades.data ?? []) as unknown as CrmOportunidade[]}
        perfis={(perfis.data ?? []) as CrmPerfilSocio[]}
        usuarioAtualId={profile.id}
      />
    </div>
  )
}
