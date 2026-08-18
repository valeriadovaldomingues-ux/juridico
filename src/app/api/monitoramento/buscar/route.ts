// ─── API Route: POST /api/monitoramento/buscar ────────────────────────────────
//
// Executa fontes formais de monitoramento. Fontes sem captura pública validada
// ficam catalogadas com status explícito e não inserem publicações.
// A lógica de execução/persistência vive em @/lib/monitoramento/executar-busca
// (compartilhada com o cron GET /api/cron/djen e com a importação via navegador).

import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { FiltroFontesMonitoramento } from '@/lib/monitoramento/fontes'
import { executarBuscaMonitoramento } from '@/lib/monitoramento/executar-busca'
import type { UserRole } from '@/types'

export const maxDuration = 300

const ROLES_MONITORAMENTO: UserRole[] = ['advogado', 'gerente', 'socio']

interface FiltroComRetroativo extends FiltroFontesMonitoramento {
  retroativoDias?: number
}

async function lerFiltro(request: Request): Promise<FiltroComRetroativo> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return {}

  try {
    const body = await request.json()
    return {
      fonte: typeof body?.fonte === 'string' ? body.fonte : undefined,
      fontes: Array.isArray(body?.fontes)
        ? body.fontes.filter((item: unknown) => typeof item === 'string')
        : undefined,
      tribunal: typeof body?.tribunal === 'string' ? body.tribunal : undefined,
      ramo: typeof body?.ramo === 'string' ? body.ramo : undefined,
      data: typeof body?.data === 'string'
        ? body.data
        : typeof body?.data_publicacao === 'string'
          ? body.data_publicacao
          : undefined,
      retroativoDias: typeof body?.retroativoDias === 'number' && body.retroativoDias >= 0 && body.retroativoDias <= 30
        ? body.retroativoDias
        : undefined,
    }
  } catch {
    return {}
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const isCronCall = !!(cronSecret && authHeader === `Bearer ${cronSecret}`)

  let usuarioId: string | null = null
  if (!isCronCall) {
    const auth = await apiGuard(ROLES_MONITORAMENTO)
    if (auth instanceof Response) {
      return Response.json(
        { erro: auth.status === 401 ? 'Não autorizado' : 'Sem permissão para acionar o monitoramento' },
        { status: auth.status },
      )
    }
    usuarioId = auth.userId
  }

  const filtro = await lerFiltro(request)
  const supabase = await createClient()

  const resultado = await executarBuscaMonitoramento({
    supabase,
    filtro,
    disparadoPor: isCronCall ? 'cron' : 'manual',
    usuarioId,
    retroativoDias: filtro.retroativoDias,
  })

  return Response.json(resultado.body, { status: resultado.status })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

  const { data: lastLog } = await supabase
    .from('monitoramento_logs')
    .select('*')
    .order('executado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json({ ultimo_log: lastLog ?? null })
}
