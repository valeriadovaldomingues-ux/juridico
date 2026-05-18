import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import RelatoriosPage from './RelatoriosPage'

export default async function RelatoriosRoute() {
  // advogado removido — relatorios apenas para gerente e sócio na nova matriz
  const { profile } = await requireRole(['gerente', 'socio'])
  const supabase = await createClient()

  const verFinanceiro = ['gerente', 'socio'].includes(profile.role)

  const [
    { data: processos },
    { data: agendaItems },
    { data: publicacoes },
    { data: kanbanTasks },
    { data: profiles },
    finResult,
  ] = await Promise.all([
    supabase
      .from('processos')
      .select('id, status, area_direito, created_at, advogado_responsavel_id, titulo, numero_processo, cliente:clientes(nome)')
      .order('created_at', { ascending: false }),
    supabase
      .from('agenda_items')
      .select('id, titulo, tipo, status, data_inicio, prazo_final, prioridade, processo_id, processo:processos(titulo, numero_processo)')
      .in('tipo', ['prazo', 'audiencia'])
      .order('data_inicio'),
    supabase
      .from('publicacoes')
      .select('id, numero_processo, tribunal, data_publicacao, tipo_publicacao, created_at')
      .eq('status', 'nao_tratada')
      .order('created_at', { ascending: false }),
    supabase
      .from('kanban_tasks')
      .select('id, titulo, status, tipo, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, nome, role')
      .eq('ativo', true)
      .order('nome'),
    verFinanceiro
      ? supabase.from('financeiro_lancamentos').select('tipo, valor, status, vencimento').neq('status', 'cancelado')
      : Promise.resolve({ data: null }),
  ])

  return (
    <RelatoriosPage
      processos={(processos  ?? []) as any}
      agendaItems={(agendaItems ?? []) as any}
      publicacoes={(publicacoes ?? []) as any}
      kanbanTasks={(kanbanTasks ?? []) as any}
      profiles={(profiles ?? []) as any}
      lancamentos={verFinanceiro ? ((finResult as any)?.data ?? null) : null}
      role={profile.role}
    />
  )
}
