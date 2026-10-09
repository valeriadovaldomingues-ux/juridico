import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { buscarHoras, dataValida } from '@/lib/relatorio-horas/dados'

// Relatório de horas por cliente — aberto a toda a equipe interna, SÓ horas (sem valores).
export const HORAS_ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const

export async function GET(req: NextRequest) {
  const auth = await apiGuard([...HORAS_ROLES])
  if (auth instanceof NextResponse) return auth

  const p = req.nextUrl.searchParams
  const clienteId = p.get('cliente_id')
  const de = p.get('de')
  const ate = p.get('ate')
  if (!clienteId || !isUUID(clienteId)) return NextResponse.json({ error: 'Escolha o cliente.' }, { status: 400 })
  if (!dataValida(de) || !dataValida(ate)) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
  if (de > ate) return NextResponse.json({ error: 'A data inicial é depois da final.' }, { status: 400 })

  const supabase = await createClient()
  return NextResponse.json(await buscarHoras(supabase, { clienteId, de, ate }))
}
