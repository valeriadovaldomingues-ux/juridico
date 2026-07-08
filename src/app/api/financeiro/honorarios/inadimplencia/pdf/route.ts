import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { gerarInadimplenciaClientePdf } from '@/lib/honorarios/pdf'
import type { HonorarioMensal } from '@/lib/honorarios/types'

export const runtime = 'nodejs'

// GET /api/financeiro/honorarios/inadimplencia/pdf?cliente_id=UUID
// Histórico de honorários do cliente nos últimos 24 meses (item 7).
export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const clienteId = new URL(req.url).searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const [{ data: cliente }, { data: registros, error }] = await Promise.all([
    supabase.from('clientes').select('id, nome').eq('id', clienteId).maybeSingle(),
    supabase
      .from('honorarios_mensais')
      .select('*, cliente:clientes(id, nome)')
      .eq('cliente_id', clienteId)
      .order('competencia', { ascending: false })
      .limit(24),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const bytes = await gerarInadimplenciaClientePdf(cliente.nome, (registros ?? []) as HonorarioMensal[])

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="inadimplencia-cliente.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
