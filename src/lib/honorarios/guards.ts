import type { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/** Verdadeiro se a competência já foi fechada (congelada para histórico). */
export async function competenciaFechada(
  supabase: SupabaseServer,
  competencia: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('honorarios_fechamentos')
    .select('id')
    .eq('competencia', competencia)
    .maybeSingle()
  return !!data
}
