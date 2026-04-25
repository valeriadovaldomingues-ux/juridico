import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProcessoDetail from './ProcessoDetail'

export default async function ProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: processo } = await supabase
    .from('processos')
    .select('*, cliente:clientes(id, nome, email, celular)')
    .eq('id', id)
    .single()

  if (!processo) notFound()

  const [
    { data: partes },
    { data: prazos },
    { data: clientes },
    { data: agendaItems },
  ] = await Promise.all([
    supabase.from('partes_processo').select('*').eq('processo_id', id),
    supabase.from('prazos').select('*').eq('processo_id', id).order('data_final', { ascending: true }),
    supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('agenda_items').select('*').eq('processo_id', id).order('data_inicio', { ascending: true }),
  ])

  return (
    <ProcessoDetail
      processo={processo}
      partes={partes ?? []}
      prazos={prazos ?? []}
      clientes={clientes ?? []}
      agendaItems={agendaItems ?? []}
    />
  )
}
