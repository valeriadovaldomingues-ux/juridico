import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

// Dado sensível — só sócio. Ver política RLS em folha_pagamento (dupla trava).

export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const mes = req.nextUrl.searchParams.get('mes') // 'YYYY-MM-01'
  if (!mes) return NextResponse.json({ error: 'Parâmetro mes ausente' }, { status: 400 })

  const supabase = await createClient()

  const [{ data: profiles, error: profilesError }, { data: folhas, error: folhasError }, { data: dadosPessoais }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nome, email, role')
      .eq('ativo', true)
      .neq('role', 'socio')
      .order('role')
      .order('nome'),
    supabase
      .from('folha_pagamento')
      .select('*')
      .eq('mes_referencia', mes),
    supabase
      .from('funcionarios_dados_pessoais')
      .select('profile_id, tipo_recibo, cpf, endereco'),
  ])

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 })
  if (folhasError) return NextResponse.json({ error: folhasError.message }, { status: 400 })

  const folhaPorProfile = new Map((folhas ?? []).map(f => [f.profile_id, f]))
  const dadosPorProfile = new Map((dadosPessoais ?? []).map(d => [d.profile_id, d]))

  const data = (profiles ?? []).map(p => {
    const dados = dadosPorProfile.get(p.id)
    return {
      profile_id:     p.id,
      nome:           p.nome,
      email:          p.email,
      role:           p.role,
      folha:          folhaPorProfile.get(p.id) ?? null,
      tipoRecibo:     dados?.tipo_recibo ?? null,
      dadosCompletos: !!(dados?.cpf && dados?.endereco),
    }
  })

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  if (!body.profile_id || !body.mes_referencia) {
    return NextResponse.json({ error: 'profile_id e mes_referencia são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const campos = [
    'dias_uteis', 'salario_base', 'salario_base_nota', 'extra', 'extra_nota',
    'partido_3_5', 'partido_20', 'alimentacao', 'transporte', 'desconto', 'desconto_nota',
    'gratificacao', 'ferias_um_terco', 'adiantamento', 'forma_pagamento', 'observacoes',
  ] as const

  const payload: Record<string, unknown> = {
    profile_id:      body.profile_id,
    mes_referencia:  body.mes_referencia,
  }
  for (const campo of campos) {
    if (campo in body) payload[campo] = body[campo] === '' ? null : body[campo]
  }

  const { data, error } = await supabase
    .from('folha_pagamento')
    .upsert(payload, { onConflict: 'profile_id,mes_referencia' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
