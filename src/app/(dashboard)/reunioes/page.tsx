import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import ReunioesPage, { type Reuniao, type TarefaDaReuniao, type Pessoa } from './ReunioesPage'

export const metadata = { title: 'Reuniões PEDV' }

export default async function Page() {
  const { profile } = await requireRole(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  const supabase = await createClient()

  const [{ data: reunioes }, { data: tarefas }, { data: equipe }] = await Promise.all([
    supabase.from('reunioes_pedv').select('id, titulo, data_reuniao, participantes, ata, criado_por, created_at')
      .order('data_reuniao', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    supabase.from('kanban_tasks').select('id, titulo, status, responsavel_id, data, reuniao_id, arquivado')
      .not('reuniao_id', 'is', null).limit(1000),
    supabase.rpc('perfis_equipe'),
  ])

  return (
    <div className="internal-page">
      <ReunioesPage
        reunioes={(reunioes ?? []) as Reuniao[]}
        tarefas={(tarefas ?? []) as TarefaDaReuniao[]}
        equipe={((equipe ?? []) as Pessoa[]).map(p => ({ id: p.id, nome: p.nome }))}
        podeCriar={['administrativo', 'advogado', 'gerente', 'socio'].includes(profile.role)}
      />
    </div>
  )
}
