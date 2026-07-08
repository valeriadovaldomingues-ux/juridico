import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { competenciaAtual } from '@/lib/honorarios/service'
import HonorariosPage from './HonorariosPage'
import type { HonorarioContrato, HonorarioMensal } from '@/lib/honorarios/types'

export default async function ControleHonorariosRoute() {
  // Apenas sócios (defense-in-depth; o proxy já restringe /financeiro).
  await requireRole(['socio'])
  const supabase = await createClient()
  const competencia = competenciaAtual()

  const [{ data: registros }, { data: contratos }, { data: fechamento }] = await Promise.all([
    supabase
      .from('honorarios_mensais')
      .select('*, cliente:clientes(id, nome)')
      .eq('competencia', competencia)
      .eq('arquivado', false)
      .order('status', { ascending: true }),
    supabase
      .from('honorarios_contratos')
      .select('*, cliente:clientes(id, nome)')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('honorarios_fechamentos')
      .select('competencia')
      .eq('competencia', competencia)
      .maybeSingle(),
  ])

  return (
    <div className="internal-page">
      <HonorariosPage
        competenciaInicial={competencia}
        registrosIniciais={(registros ?? []) as HonorarioMensal[]}
        contratosIniciais={(contratos ?? []) as HonorarioContrato[]}
        fechadoInicial={!!fechamento}
      />
    </div>
  )
}
