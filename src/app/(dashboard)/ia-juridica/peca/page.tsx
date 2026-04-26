import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import PecaIA from './PecaIA'

export default async function PecaPage() {
  const { userId } = await requireRole(['advogado', 'gerente', 'socio'])
  const supabase   = await createClient()

  const { data: processos } = await supabase
    .from('processos')
    .select(`
      id, numero_processo, titulo, area_direito,
      tribunal, vara, valor_causa, observacoes,
      cliente:clientes(id, nome),
      partes_processo(id, pessoa_nome, tipo_parte)
    `)
    .in('status', ['ativo', 'suspenso'])
    .order('titulo')

  const processoIds = (processos ?? []).map(p => p.id)

  const [agendaRes, profileRes] = await Promise.all([
    processoIds.length > 0
      ? supabase
          .from('agenda_items')
          .select('processo_id, titulo, tipo, prazo_final, data_inicio')
          .in('processo_id', processoIds)
          .eq('status', 'pendente')
          .gte('prazo_final', new Date().toISOString().slice(0, 10))
          .lte('prazo_final', new Date(Date.now() + 60 * 86400 * 1000).toISOString().slice(0, 10))
          .order('prazo_final')
      : Promise.resolve({ data: [] }),

    supabase.from('profiles').select('id, nome, role').eq('id', userId).single(),
  ])

  const prazosPorProcesso: Record<string, Array<{ titulo: string; data: string; tipo: string }>> = {}
  for (const a of agendaRes.data ?? []) {
    if (!a.processo_id) continue
    if (!prazosPorProcesso[a.processo_id]) prazosPorProcesso[a.processo_id] = []
    prazosPorProcesso[a.processo_id].push({
      titulo: a.titulo,
      data:   (a.prazo_final ?? a.data_inicio) as string,
      tipo:   a.tipo as string,
    })
  }

  return (
    <PecaIA
      processos={(processos ?? []) as any}
      prazosPorProcesso={prazosPorProcesso}
      advogadoNome={profileRes.data?.nome ?? null}
      role={(profileRes.data?.role ?? 'advogado') as string}
    />
  )
}
