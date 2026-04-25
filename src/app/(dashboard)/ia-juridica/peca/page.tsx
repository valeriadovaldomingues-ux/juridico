import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import PecaIA from './PecaIA'

export default async function PecaPage() {
  await requireRole(['advogado', 'gerente', 'socio'])
  const supabase = await createClient()

  const { data: processos } = await supabase
    .from('processos')
    .select(`
      id, numero_processo, titulo, area_direito,
      tribunal, vara, valor_causa,
      cliente:clientes(id, nome),
      partes_processo(id, pessoa_nome, tipo_parte)
    `)
    .in('status', ['ativo', 'suspenso'])
    .order('titulo')

  return <PecaIA processos={(processos ?? []) as any} />
}
