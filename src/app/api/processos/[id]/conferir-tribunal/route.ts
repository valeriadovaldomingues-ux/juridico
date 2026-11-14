import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { consultarDataJud } from '@/lib/datajud/consulta'

const ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const
export const maxDuration = 60

// GET /api/processos/[id]/conferir-tribunal — consulta o DataJud (CNJ) e devolve o que o tribunal informa ao lado do que o PEDV tem. Só leitura.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard([...ROLES])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Processo inválido.' }, { status: 400 })

  const supabase = await createClient()
  const { data: p } = await supabase.from('processos').select('numero_processo, vara, comarca, classe_processual, data_distribuicao').eq('id', id).maybeSingle()
  if (!p) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })
  if (!p.numero_processo) return NextResponse.json({ error: 'Este processo não tem número cadastrado.' }, { status: 422 })

  const r = await consultarDataJud(p.numero_processo)
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 502 })
  return NextResponse.json({
    numero: p.numero_processo,
    pedv: { vara: p.vara, comarca: p.comarca, classe: p.classe_processual, distribuicao: p.data_distribuicao },
    tribunal: r.processos,
    fonte: 'CNJ — DataJud (API pública). Pode ter atraso, não mostra as partes nem processos em segredo de justiça.',
  })
}
