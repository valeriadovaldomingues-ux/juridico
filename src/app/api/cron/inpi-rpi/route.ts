// ─── API Route: GET /api/cron/inpi-rpi ───────────────────────────────────────
//
// Execução agendada da sincronização com a RPI do INPI (Vercel Cron chama com
// GET e envia `Authorization: Bearer ${CRON_SECRET}` — ver vercel.json).
//
// Roda semanalmente (a RPI é publicada uma vez por semana), mas é idempotente
// e barata de rodar mais vezes: se não há edição nova, não faz nada.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sincronizarRpi } from '@/lib/inpi/rpi-sync'

export const maxDuration = 120

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization') ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const resultado = await sincronizarRpi(supabase)
  return Response.json(resultado, { status: resultado.ok ? 200 : 500 })
}
