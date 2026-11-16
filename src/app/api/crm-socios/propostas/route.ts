import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exigirSocios, lerJson, respostaErroBanco } from '@/lib/crm-socios/api'
import { TABELA_PROPOSTAS } from '@/lib/crm-socios/constants'
import { lerProposta } from '@/lib/crm-socios/validacao'

// POST /api/crm-socios/propostas — { oportunidade_id, titulo, valor, tipo_honorario, ... }
// Não mexe na etapa da oportunidade: quem sugere (e pede confirmação) é a tela.
export async function POST(req: NextRequest) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const lido = lerProposta(await lerJson(req), 'criar')
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABELA_PROPOSTAS)
    .insert({
      ...lido.dados,
      oportunidade_id: lido.dados.oportunidade_id!,
      titulo: lido.dados.titulo!,
      criado_por: auth.userId,
    })
    .select('*')
    .single()

  if (error) return respostaErroBanco(error, 'Não foi possível criar a proposta.')
  return NextResponse.json(data, { status: 201 })
}
