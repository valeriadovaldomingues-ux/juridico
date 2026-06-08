import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClienteForm from '../ClienteForm'
import ClienteDetail from './ClienteDetail'
import { Users } from 'lucide-react'
import { requireRole } from '@/lib/auth/guards'
import { canEditClienteContatos } from '@/lib/cliente-contatos'
import { listClienteContatos } from '@/lib/cliente-contatos'

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireRole(['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'])
  const supabase = await createClient()

  if (id === 'novo') {
    return (
      <div className="internal-page space-y-6 max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
              Cadastro de contato
            </p>
            <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">
              Novo Contato
            </h1>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2 flex items-center gap-1.5">
              <Users size={12} />
              Preencha os dados do contato para uso interno.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] p-1 sm:p-2">
          <ClienteForm />
        </div>
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
    contatos,
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

    listClienteContatos(id),
  ])

  return (
    <div className="internal-page max-w-7xl">
      <ClienteDetail
        cliente={cliente as any}
        processos={processos ?? []}
        interactions={interactions ?? []}
        tarefas={tarefas ?? []}
        agenda={agenda ?? []}
        contatos={contatos ?? []}
        canEditContatos={canEditClienteContatos(session.profile.role)}
      />
    </div>
  )
}
