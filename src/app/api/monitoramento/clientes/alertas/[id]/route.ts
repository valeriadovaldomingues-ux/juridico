// ─── API: PATCH /api/monitoramento/clientes/alertas/[id] ─────────────────────
//
// Trata o alerta: visto | descartado | processo_cadastrado (+ processo_id opcional
// apontando para o processo cadastrado).

import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { isUUID } from '@/lib/portal/validate'
import { PAPEIS_ESCRITA, respostaErroBanco } from '@/lib/monitoramento-clientes/api'

const STATUS_PERMITIDOS = ['visto', 'descartado', 'processo_cadastrado'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(PAPEIS_ESCRITA)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 })

  let corpo: { status?: unknown; processo_id?: unknown }
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }) }

  const status = corpo?.status
  if (typeof status !== 'string' || !(STATUS_PERMITIDOS as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'status deve ser visto, descartado ou processo_cadastrado.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const patch: Record<string, unknown> = { status }

  if (corpo.processo_id !== undefined && corpo.processo_id !== null) {
    if (!isUUID(corpo.processo_id)) return NextResponse.json({ error: 'processo_id inválido.' }, { status: 400 })
    if (status !== 'processo_cadastrado') {
      return NextResponse.json({ error: 'processo_id só vale com status processo_cadastrado.' }, { status: 400 })
    }
    const { data: processo, error: erroProcesso } = await supabase
      .from('processos').select('id').eq('id', corpo.processo_id).maybeSingle()
    if (erroProcesso) return respostaErroBanco(erroProcesso, 'Falha ao conferir o processo')
    if (!processo) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 400 })
    patch.processo_id = corpo.processo_id
  }

  const { data, error } = await supabase
    .from('monitoramento_alertas')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) return respostaErroBanco(error, 'Falha ao atualizar alerta')
  if (!data) return NextResponse.json({ error: 'Alerta não encontrado.' }, { status: 404 })
  return NextResponse.json({ alerta: data })
}
