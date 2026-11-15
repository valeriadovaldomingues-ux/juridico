import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  SELECT_OPORTUNIDADE, exigirSocios, lerJson, respostaErroBanco, responsavelEhSocio,
} from '@/lib/crm-socios/api'
import {
  ETAPA_PERDIDO, TABELA_INTERACOES, TABELA_OPORTUNIDADES, TABELA_PROPOSTAS, type EtapaId,
} from '@/lib/crm-socios/constants'
import { validarMovimento } from '@/lib/crm-socios/regras'
import { ehUUID, lerOportunidade } from '@/lib/crm-socios/validacao'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/crm-socios/oportunidades/[id] — ficha com interações e propostas
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!ehUUID(id)) return NextResponse.json({ error: 'Oportunidade inválida.' }, { status: 400 })

  const supabase = await createClient()
  const [opRes, interRes, propRes] = await Promise.all([
    supabase.from(TABELA_OPORTUNIDADES).select(SELECT_OPORTUNIDADE).eq('id', id).maybeSingle(),
    supabase
      .from(TABELA_INTERACOES)
      .select('*, autor:profiles!autor_id(id, nome)')
      .eq('oportunidade_id', id)
      .order('data_interacao', { ascending: false }),
    supabase
      .from(TABELA_PROPOSTAS)
      .select('*')
      .eq('oportunidade_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (opRes.error) return respostaErroBanco(opRes.error, 'Não foi possível carregar a oportunidade.')
  if (!opRes.data) return NextResponse.json({ error: 'Oportunidade não encontrada.' }, { status: 404 })
  if (interRes.error) return respostaErroBanco(interRes.error, 'Não foi possível carregar o histórico.')
  if (propRes.error) return respostaErroBanco(propRes.error, 'Não foi possível carregar as propostas.')

  return NextResponse.json({
    ...opRes.data,
    interacoes: interRes.data ?? [],
    propostas: propRes.data ?? [],
  })
}

// PATCH /api/crm-socios/oportunidades/[id]
// Aceita qualquer subconjunto de campos. Mudar `etapa` deriva o status e trata motivo/fechamento.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!ehUUID(id)) return NextResponse.json({ error: 'Oportunidade inválida.' }, { status: 400 })

  const lido = lerOportunidade(await lerJson(req), 'editar')
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 })
  const dados = lido.dados
  if (Object.keys(dados).length === 0) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })

  const supabase = await createClient()

  const { data: atual, error: erroAtual } = await supabase
    .from(TABELA_OPORTUNIDADES)
    .select('etapa, motivo_perda, data_fechamento')
    .eq('id', id)
    .maybeSingle()
  if (erroAtual) return respostaErroBanco(erroAtual, 'Não foi possível carregar a oportunidade.')
  if (!atual) return NextResponse.json({ error: 'Oportunidade não encontrada.' }, { status: 404 })

  if (dados.responsavel_id && !(await responsavelEhSocio(supabase, dados.responsavel_id))) {
    return NextResponse.json({ error: 'O responsável precisa ser um dos sócios.' }, { status: 400 })
  }

  const etapaAtual = atual.etapa as EtapaId
  const etapaFinal = dados.etapa ?? etapaAtual
  const motivoInformado = dados.motivo_perda !== undefined ? dados.motivo_perda : atual.motivo_perda

  const mov = validarMovimento(etapaAtual, etapaFinal, motivoInformado)
  if (!mov.ok) return NextResponse.json({ error: mov.erro }, { status: 400 })

  const atualizacao: Record<string, unknown> = { ...dados }
  atualizacao.etapa = mov.etapa
  atualizacao.status = mov.status
  // Motivo só existe em "Perdido"; em qualquer outra etapa é limpo.
  atualizacao.motivo_perda = etapaFinal === ETAPA_PERDIDO ? mov.motivo_perda : null
  if (etapaFinal !== etapaAtual) {
    atualizacao.data_fechamento = mov.fechada ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from(TABELA_OPORTUNIDADES)
    .update(atualizacao)
    .eq('id', id)
    .select(SELECT_OPORTUNIDADE)
    .single()

  if (error) return respostaErroBanco(error, 'Não foi possível salvar a oportunidade.')
  return NextResponse.json(data)
}

// DELETE /api/crm-socios/oportunidades/[id] — interações e propostas caem junto (ON DELETE CASCADE)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!ehUUID(id)) return NextResponse.json({ error: 'Oportunidade inválida.' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from(TABELA_OPORTUNIDADES).delete().eq('id', id)
  if (error) return respostaErroBanco(error, 'Não foi possível excluir a oportunidade.')
  return NextResponse.json({ ok: true })
}
