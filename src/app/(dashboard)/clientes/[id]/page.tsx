import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClienteForm from '../ClienteForm'
import ClienteDetail from './ClienteDetail'

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  if (id === 'novo') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-[#1a1d23]">Novo Contato</h1>
          <p className="text-sm text-[#6b7280] mt-0.5">Preencha os dados do contato</p>
        </div>
        <ClienteForm />
      </div>
    )
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*, responsavel:profiles!responsavel_id(id, nome, role)')
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  const { data: processos } = await supabase
    .from('processos')
    .select('id, titulo, numero_processo, area_direito, status, advogado_responsavel_id, tribunal, valor_causa')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })

  const processoIds = (processos ?? []).map(p => p.id)

  const [
    { data: interactions },
    { data: tarefas },
    { data: agenda },
    { data: profiles },
    { count: publicacoesCount },
  ] = await Promise.all([
    supabase
      .from('contact_interactions')
      .select('*, usuario:profiles(id, nome, role)')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(100),

    processoIds.length > 0
      ? supabase
          .from('kanban_tasks')
          .select('id, titulo, status, data, tipo, processo_id, responsavel_id, prioridade')
          .in('processo_id', processoIds)
          .order('data', { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] }),

    // BUG FIX: coluna correta é data_fim (não data_final)
    supabase
      .from('agenda_items')
      .select('id, titulo, data_inicio, data_fim, prazo_final, tipo, status, prioridade')
      .eq('cliente_id', id)
      .order('data_inicio', { ascending: false })
      .limit(30),

    // Profiles para criação de tarefas
    supabase
      .from('profiles')
      .select('id, nome, role')
      .eq('ativo', true)
      .order('nome'),

    // Contagem de publicações vinculadas aos processos
    processoIds.length > 0
      ? supabase
          .from('publicacoes')
          .select('id', { count: 'exact', head: true })
          .in('processo_id', processoIds)
          .eq('status', 'nao_tratada')
      : Promise.resolve({ data: null, count: 0, error: null, status: 200, statusText: 'OK' }),
  ])

  return (
    <ClienteDetail
      cliente={cliente as any}
      processos={processos ?? []}
      interactions={interactions ?? []}
      tarefas={tarefas ?? []}
      agenda={agenda ?? []}
      profiles={(profiles ?? []) as any}
      publicacoesPendentes={publicacoesCount ?? 0}
    />
  )
}
