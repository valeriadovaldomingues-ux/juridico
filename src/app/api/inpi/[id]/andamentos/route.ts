import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { isUUID } from '@/lib/portal/validate'
import { INPI_ANDAMENTO_TIPO_LABEL, type InpiAndamentoTipo } from '@/types/inpi'
import type { UserRole } from '@/types'

const EDIT_ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']
const ISO = /^\d{4}-\d{2}-\d{2}$/

// POST /api/inpi/[id]/andamentos — o advogado registra o que fez no processo do INPI.
// "Prorrogação deferida" soma mais 10 anos à vigência (inpi_processos.prorrogacoes).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(EDIT_ALLOWED)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Processo inválido.' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const tipo = String(body?.tipo ?? '')
  const titulo = String(body?.titulo ?? '').trim().slice(0, 160)
  const data = String(body?.data_andamento ?? '')
  const descricao = String(body?.descricao ?? '').trim() || null
  const protocolo = String(body?.protocolo ?? '').trim().slice(0, 60) || null
  const responsavelId = body?.responsavel_id && isUUID(String(body.responsavel_id)) ? String(body.responsavel_id) : null

  if (!(tipo in INPI_ANDAMENTO_TIPO_LABEL)) return NextResponse.json({ error: 'Tipo de andamento inválido.' }, { status: 400 })
  if (!titulo) return NextResponse.json({ error: 'Dê um título ao andamento.' }, { status: 400 })
  if (!ISO.test(data)) return NextResponse.json({ error: 'Informe a data do andamento.' }, { status: 400 })
  const prorrogacaoDeferida = tipo === 'prorrogacao' && body?.prorrogacao_deferida === true

  const supabase = await createClient()
  const { data: processo } = await supabase.from('inpi_processos').select('id, prorrogacoes').eq('id', id).maybeSingle()
  if (!processo) return NextResponse.json({ error: 'Processo INPI não encontrado.' }, { status: 404 })

  const { data: equipe } = await supabase.rpc('perfis_equipe')
  const nomeDe = new Map(((equipe ?? []) as { id: string; nome: string }[]).map(p => [p.id, p.nome]))

  const { data: andamento, error } = await supabase
    .from('inpi_andamentos')
    .insert({
      inpi_processo_id: id, data_andamento: data, tipo: tipo as InpiAndamentoTipo, titulo, descricao, protocolo,
      prorrogacao_deferida: prorrogacaoDeferida,
      responsavel_id: responsavelId, responsavel_nome: responsavelId ? nomeDe.get(responsavelId) ?? null : null,
      criado_por: auth.userId, criado_por_nome: nomeDe.get(auth.userId) ?? null,
    })
    .select('*')
    .single()
  if (error || !andamento) return NextResponse.json({ error: error?.message ?? 'Não foi possível salvar.' }, { status: 500 })

  let prorrogacoes: number | null = null
  if (prorrogacaoDeferida) {
    prorrogacoes = (processo.prorrogacoes ?? 0) + 1
    const { error: errProc } = await supabase.from('inpi_processos').update({ prorrogacoes }).eq('id', id)
    if (errProc) return NextResponse.json({ ...andamento, aviso: `Andamento salvo, mas a vigência não foi atualizada: ${errProc.message}` }, { status: 201 })
  }

  return NextResponse.json({ ...andamento, prorrogacoes }, { status: 201 })
}
