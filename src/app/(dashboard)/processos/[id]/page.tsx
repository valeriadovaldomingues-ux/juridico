import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import { notFound } from 'next/navigation'
import ProcessoDetail from './ProcessoDetail'

export default async function ProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
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
    { data: agendaItems },
    { data: andamentos },
    { data: relatorios },
    { data: documentos },
  ] = await Promise.all([
    supabase.from('partes_processo').select('*').eq('processo_id', id),
    supabase.from('prazos').select('*').eq('processo_id', id).order('data_final', { ascending: true }),
    supabase.from('agenda_items').select('*').eq('processo_id', id).order('data_inicio', { ascending: true }),
    supabase
      .from('processo_andamentos')
      .select('*, responsavel:profiles(id, nome, email, role), criado_por_profile:profiles!criado_por(id, nome, email, role)')
      .eq('processo_id', id)
      .order('data_andamento', { ascending: false }),
    supabase
      .from('client_reports')
      .select(`
        *,
        gerado_por_profile:profiles!gerado_por(id, nome, email, role),
        aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
        publicado_por_profile:profiles!publicado_por(id, nome, email, role)
      `)
      .eq('processo_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documentos')
      .select('id, processo_id, cliente_id, nome_arquivo, tipo_documento, storage_path, uploaded_by, created_at, uploaded_by_profile:profiles!uploaded_by(id, nome, email, role)')
      .eq('processo_id', id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="internal-page max-w-7xl">
        <ProcessoDetail
          processo={processo}
          partes={partes ?? []}
          prazos={prazos ?? []}
          agendaItems={agendaItems ?? []}
          andamentos={(andamentos ?? []) as any}
          relatorios={(relatorios ?? []) as any}
          documentos={(documentos ?? []) as any}
          role={auth.profile.role}
        />
    </div>
  )
}
