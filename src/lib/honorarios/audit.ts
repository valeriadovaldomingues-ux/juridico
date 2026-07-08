// Auditoria dos lançamentos de honorários (item 4/5).
// Espelha o padrão de src/lib/relatorios-inteligentes/api.ts (registrarLogRelatorio).

import type { createClient } from '@/lib/supabase/server'
import type { HonorarioLogAcao } from './types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export interface LogHonorarioEntrada {
  registro_id?: string | null
  extra_id?: string | null
  acao: HonorarioLogAcao
  detalhes?: Record<string, unknown>
  valor_anterior?: number | null
  status_anterior?: string | null
}

export async function registrarLogHonorario(
  supabase: SupabaseServer,
  entrada: LogHonorarioEntrada,
  executadoPor: string,
): Promise<void> {
  await supabase.from('honorarios_logs').insert({
    registro_id:     entrada.registro_id ?? null,
    extra_id:        entrada.extra_id ?? null,
    acao:            entrada.acao,
    detalhes:        entrada.detalhes ?? {},
    valor_anterior:  entrada.valor_anterior ?? null,
    status_anterior: entrada.status_anterior ?? null,
    executado_por:   executadoPor,
  })
}
