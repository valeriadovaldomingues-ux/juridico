import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { isUUID } from '@/lib/portal/validate'
import type { UserRole } from '@/types'

// DELETE — só sócio apaga um andamento (ex.: lançado errado). Se ele tinha marcado "prorrogação deferida",
// a contagem de prorrogações do processo volta uma.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; andId: string }> }) {
  const auth = await apiGuard(['socio'] as UserRole[])
  if (auth instanceof NextResponse) return auth
  const { id, andId } = await params
  if (!isUUID(id) || !isUUID(andId)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const supabase = await createClient()
  const { data: andamento } = await supabase
    .from('inpi_andamentos').select('id, prorrogacao_deferida').eq('id', andId).eq('inpi_processo_id', id).maybeSingle()
  if (!andamento) return NextResponse.json({ error: 'Andamento não encontrado.' }, { status: 404 })

  const { error } = await supabase.from('inpi_andamentos').delete().eq('id', andId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (andamento.prorrogacao_deferida) {
    const { data: proc } = await supabase.from('inpi_processos').select('prorrogacoes').eq('id', id).maybeSingle()
    await supabase.from('inpi_processos').update({ prorrogacoes: Math.max(0, (proc?.prorrogacoes ?? 1) - 1) }).eq('id', id)
  }
  return new NextResponse(null, { status: 204 })
}
