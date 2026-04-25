import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import PublicacaoIA from './PublicacaoIA'

export default async function PublicacaoPage() {
  const { profile } = await requireRole(['advogado', 'gerente', 'socio'])
  const supabase = await createClient()

  const [{ data: publicacoes }, { data: processos }] = await Promise.all([
    supabase
      .from('publicacoes')
      .select('id, resumo, numero_processo, tribunal, status, created_at')
      .order('data_publicacao', { ascending: false })
      .limit(200),
    supabase
      .from('processos')
      .select('id, numero_processo, titulo')
      .in('status', ['ativo', 'suspenso'])
      .order('titulo'),
  ])

  return (
    <PublicacaoIA
      publicacoes={(publicacoes ?? []) as any}
      processos={(processos ?? []) as any}
      userId={profile.id}
    />
  )
}
