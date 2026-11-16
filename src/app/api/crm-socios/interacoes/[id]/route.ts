import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exigirSocios, respostaErroBanco } from '@/lib/crm-socios/api'
import { TABELA_INTERACOES, TABELA_OPORTUNIDADES } from '@/lib/crm-socios/constants'
import { ehUUID } from '@/lib/crm-socios/validacao'

type Ctx = { params: Promise<{ id: string }> }

// DELETE /api/crm-socios/interacoes/[id]
// Apaga a interação e recalcula o "último contato" da oportunidade a partir das que sobraram.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!ehUUID(id)) return NextResponse.json({ error: 'Interação inválida.' }, { status: 400 })

  const supabase = await createClient()

  const { data: alvo, error: erroAlvo } = await supabase
    .from(TABELA_INTERACOES)
    .select('id, oportunidade_id')
    .eq('id', id)
    .maybeSingle()
  if (erroAlvo) return respostaErroBanco(erroAlvo, 'Não foi possível carregar a interação.')
  if (!alvo) return NextResponse.json({ error: 'Interação não encontrada.' }, { status: 404 })

  const { error } = await supabase.from(TABELA_INTERACOES).delete().eq('id', id)
  if (error) return respostaErroBanco(error, 'Não foi possível excluir a interação.')

  const { data: ultima } = await supabase
    .from(TABELA_INTERACOES)
    .select('data_interacao')
    .eq('oportunidade_id', alvo.oportunidade_id)
    .order('data_interacao', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ultimoContato = (ultima?.data_interacao as string | undefined) ?? null
  await supabase
    .from(TABELA_OPORTUNIDADES)
    .update({ ultimo_contato_em: ultimoContato })
    .eq('id', alvo.oportunidade_id)

  return NextResponse.json({ ok: true, oportunidade_id: alvo.oportunidade_id, ultimo_contato_em: ultimoContato })
}
