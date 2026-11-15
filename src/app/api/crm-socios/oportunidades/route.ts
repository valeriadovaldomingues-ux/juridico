import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  SELECT_OPORTUNIDADE, exigirSocios, lerJson, respostaErroBanco, responsavelEhSocio,
} from '@/lib/crm-socios/api'
import { ETAPA_INICIAL, TABELA_OPORTUNIDADES, STATUS_OPORTUNIDADE, type StatusOportunidade } from '@/lib/crm-socios/constants'
import { ehEtapaValida, validarMovimento } from '@/lib/crm-socios/regras'
import { ehUUID, lerOportunidade } from '@/lib/crm-socios/validacao'

// CRM Cris e Val — só sócios (exigirSocios) e, no banco, RLS current_user_role() = 'socio'.
// Não confundir com /api/comercial/leads (CRM da Luciana).

// GET /api/crm-socios/oportunidades?etapa=&status=&responsavel_id=
export async function GET(req: NextRequest) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const sp = new URL(req.url).searchParams
  const etapa = sp.get('etapa')
  const status = sp.get('status')
  const responsavelId = sp.get('responsavel_id')

  const supabase = await createClient()
  let query = supabase
    .from(TABELA_OPORTUNIDADES)
    .select(SELECT_OPORTUNIDADE)
    .order('created_at', { ascending: false })

  if (etapa) {
    if (!ehEtapaValida(etapa)) return NextResponse.json({ error: 'Etapa inválida.' }, { status: 400 })
    query = query.eq('etapa', etapa)
  }
  if (status) {
    if (!(STATUS_OPORTUNIDADE as readonly string[]).includes(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    query = query.eq('status', status as StatusOportunidade)
  }
  if (responsavelId) {
    if (!ehUUID(responsavelId)) return NextResponse.json({ error: 'Responsável inválido.' }, { status: 400 })
    query = query.eq('responsavel_id', responsavelId)
  }

  const { data, error } = await query
  if (error) return respostaErroBanco(error, 'Não foi possível carregar as oportunidades.')
  return NextResponse.json(data)
}

// POST /api/crm-socios/oportunidades
export async function POST(req: NextRequest) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const lido = lerOportunidade(await lerJson(req), 'criar')
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 })
  const dados = lido.dados

  const supabase = await createClient()

  // Responsável padrão: quem está criando.
  const responsavelId = dados.responsavel_id === undefined ? auth.userId : dados.responsavel_id
  if (responsavelId && !(await responsavelEhSocio(supabase, responsavelId))) {
    return NextResponse.json({ error: 'O responsável precisa ser um dos sócios.' }, { status: 400 })
  }

  const mov = validarMovimento(ETAPA_INICIAL, dados.etapa ?? ETAPA_INICIAL, dados.motivo_perda)
  if (!mov.ok) return NextResponse.json({ error: mov.erro }, { status: 400 })

  const { data, error } = await supabase
    .from(TABELA_OPORTUNIDADES)
    .insert({
      ...dados,
      nome: dados.nome!,
      responsavel_id: responsavelId,
      etapa: mov.etapa,
      status: mov.status,
      motivo_perda: mov.motivo_perda,
      data_fechamento: mov.fechada ? new Date().toISOString() : null,
      criado_por: auth.userId,
    })
    .select(SELECT_OPORTUNIDADE)
    .single()

  if (error) return respostaErroBanco(error, 'Não foi possível criar a oportunidade.')
  return NextResponse.json(data, { status: 201 })
}
