import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { gerarHonorariosXlsx } from '@/lib/honorarios/xlsx'
import type { HonorarioMensal } from '@/lib/honorarios/types'

export const runtime = 'nodejs'

// GET /api/financeiro/honorarios/inadimplencia/xlsx?cliente_id=UUID (últimos 24 meses)
export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const clienteId = new URL(req.url).searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_mensais')
    .select('*, cliente:clientes(id, nome), responsavel:profiles!responsavel_lancamento_id(id, nome)')
    .eq('cliente_id', clienteId)
    .order('competencia', { ascending: false })
    .limit(24)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bytes = gerarHonorariosXlsx((data ?? []) as HonorarioMensal[], 'Historico cliente')

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="honorarios-cliente.xlsx"`,
      'cache-control': 'no-store',
    },
  })
}
