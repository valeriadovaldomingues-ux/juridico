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

  // Processos primeiro, pois as tarefas dependem dos IDs
  const { data: processos } = await supabase
    .from('processos')
    .select('id, titulo, numero_processo, area_direito, status, advogado_responsavel_id')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })

  const processoIds = (processos ?? []).map(p => p.id)

  const [
    { data: interactions },
    { data: tarefas },
    { data: agenda },
  ] = await Promise.all([
    supabase
      .from('contact_interactions')
      .select('*, usuario:profiles(id, nome, role)')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(50),

    processoIds.length > 0
      ? supabase
          .from('kanban_tasks')
          .select('id, titulo, status, data, tipo, processo_id')
          .in('processo_id', processoIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),

    supabase
      .from('agenda_items')
      .select('id, titulo, data_inicio, data_final, tipo, status')
      .eq('cliente_id', id)
      .order('data_inicio', { ascending: false })
      .limit(20),
  ])

  return (
    <ClienteDetail
      cliente={cliente as any}
      processos={processos ?? []}
      interactions={interactions ?? []}
      tarefas={tarefas ?? []}
      agenda={agenda ?? []}
    />
  )
}
