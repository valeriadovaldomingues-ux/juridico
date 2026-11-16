import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exigirSocios, lerJson, respostaErroBanco } from '@/lib/crm-socios/api'
import { TABELA_INTERACOES, TABELA_OPORTUNIDADES } from '@/lib/crm-socios/constants'
import { ehUUID, lerInteracao } from '@/lib/crm-socios/validacao'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/crm-socios/oportunidades/[id]/interacoes
// Registra a interação e atualiza o "último contato" da oportunidade (o mais recente vale).
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!ehUUID(id)) return NextResponse.json({ error: 'Oportunidade inválida.' }, { status: 400 })

  const lido = lerInteracao(await lerJson(req))
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 })

  const supabase = await createClient()

  const { data: op, error: erroOp } = await supabase
    .from(TABELA_OPORTUNIDADES)
    .select('id, ultimo_contato_em')
    .eq('id', id)
    .maybeSingle()
  if (erroOp) return respostaErroBanco(erroOp, 'Não foi possível carregar a oportunidade.')
  if (!op) return NextResponse.json({ error: 'Oportunidade não encontrada.' }, { status: 404 })

  const { data: interacao, error } = await supabase
    .from(TABELA_INTERACOES)
    .insert({ ...lido.dados, oportunidade_id: id, autor_id: auth.userId })
    .select('*, autor:profiles!autor_id(id, nome)')
    .single()
  if (error) return respostaErroBanco(error, 'Não foi possível registrar a interação.')

  const anterior = op.ultimo_contato_em as string | null
  const novo = !anterior || new Date(lido.dados.data_interacao) > new Date(anterior)
    ? lido.dados.data_interacao
    : anterior

  let ultimoContato = anterior
  if (novo !== anterior) {
    const { error: erroUp } = await supabase
      .from(TABELA_OPORTUNIDADES)
      .update({ ultimo_contato_em: novo })
      .eq('id', id)
    if (!erroUp) ultimoContato = novo
  }

  return NextResponse.json({ interacao, ultimo_contato_em: ultimoContato }, { status: 201 })
}
