import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

// Dado sensível — só sócio. Ver política RLS em funcionarios_salarios (dupla trava).

export async function GET() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const [{ data: profiles, error: profilesError }, { data: salarios, error: salariosError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nome, email, role')
      .eq('ativo', true)
      .neq('role', 'socio')
      .order('role')
      .order('nome'),
    supabase
      .from('funcionarios_salarios')
      .select('profile_id, valor_salario, dia_pagamento, forma_pagamento, observacoes, updated_at'),
  ])

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 })
  if (salariosError) return NextResponse.json({ error: salariosError.message }, { status: 400 })

  const salarioPorProfile = new Map((salarios ?? []).map(s => [s.profile_id, s]))

  const data = (profiles ?? []).map(p => {
    const s = salarioPorProfile.get(p.id)
    return {
      profile_id:      p.id,
      nome:            p.nome,
      email:           p.email,
      role:            p.role,
      valor_salario:   s?.valor_salario   ?? null,
      dia_pagamento:   s?.dia_pagamento   ?? null,
      forma_pagamento: s?.forma_pagamento ?? null,
      observacoes:     s?.observacoes     ?? null,
      updated_at:      s?.updated_at      ?? null,
    }
  })

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  if (!body.profile_id) return NextResponse.json({ error: 'profile_id ausente' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('funcionarios_salarios')
    .upsert({
      profile_id:      body.profile_id,
      valor_salario:   body.valor_salario   !== '' && body.valor_salario   !== undefined ? Number(body.valor_salario) : null,
      dia_pagamento:   body.dia_pagamento   !== '' && body.dia_pagamento   !== undefined ? Number(body.dia_pagamento) : null,
      forma_pagamento: body.forma_pagamento || null,
      observacoes:     body.observacoes     || null,
    }, { onConflict: 'profile_id' })
    .select('profile_id, valor_salario, dia_pagamento, forma_pagamento, observacoes, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
