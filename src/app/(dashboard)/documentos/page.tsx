import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import DocumentosPage from './DocumentosPage'

export default async function DocumentosRoute() {
  // estagiario adicionado — pode visualizar documentos na nova matriz
  const { profile } = await requireRole(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  const supabase = await createClient()

  const [
    { data: modelos },
    { data: gerados },
    { data: processos },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from('doc_modelos')
      .select('id, nome, area_direito, tipo_documento, descricao, conteudo, created_at')
      .eq('ativo', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('doc_gerados')
      .select('id, titulo, conteudo, created_at, updated_at, modelo:doc_modelos(nome), processo:processos(id, titulo, numero_processo)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('processos')
      .select('id, numero_processo, titulo, area_direito, tribunal, vara, valor_causa, advogado_responsavel_id, cliente:clientes(nome), partes_processo(pessoa_nome, tipo_parte)')
      .in('status', ['ativo', 'suspenso'])
      .order('titulo'),
    supabase
      .from('profiles')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome'),
  ])

  return (
    <DocumentosPage
      modelos={(modelos   ?? []) as any}
      gerados={(gerados   ?? []) as any}
      processos={(processos ?? []) as any}
      profiles={(profiles ?? []) as any}
      role={profile.role}
    />
  )
}
