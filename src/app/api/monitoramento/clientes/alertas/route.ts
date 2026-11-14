// ─── API: GET /api/monitoramento/clientes/alertas?status=novo ────────────────
//
// status: novo (padrão) | visto | descartado | processo_cadastrado | todos

import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { PAPEIS_LEITURA, respostaErroBanco, STATUS_ALERTA } from '@/lib/monitoramento-clientes/api'

const LIMITE = 300

export async function GET(req: NextRequest) {
  const auth = await apiGuard(PAPEIS_LEITURA)
  if (auth instanceof NextResponse) return auth

  const status = req.nextUrl.searchParams.get('status') ?? 'novo'
  if (status !== 'todos' && !(STATUS_ALERTA as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'status inválido.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  let consulta = supabase
    .from('monitoramento_alertas')
    .select('*, monitoramento:monitoramento_documentos(id, nome_principal, documento, tipo, cliente_id)')
    .order('data_disponibilizacao', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(LIMITE)
  if (status !== 'todos') consulta = consulta.eq('status', status)

  const { data, error } = await consulta
  if (error) return respostaErroBanco(error, 'Falha ao listar alertas')

  const alertas = ((data ?? []) as Array<Record<string, unknown> & { monitoramento?: unknown }>).map(a => ({
    ...a,
    monitoramento: (Array.isArray(a.monitoramento) ? a.monitoramento[0] : a.monitoramento) ?? null,
  }))
  return NextResponse.json({ alertas })
}
