import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

// Receita Partido mês a mês. GET ?ano=2026 → registros do ano; PUT { grade_id, mes: "2026-03", valor?, status? } → grava o mês.
const STATUS = ['pendente', 'pago', 'vencido']

export async function GET(req: NextRequest) {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  const anoParam = Number(req.nextUrl.searchParams.get('ano'))
  const ano = Number.isInteger(anoParam) && anoParam > 2000 && anoParam < 2100 ? anoParam : new Date().getFullYear()

  const supabase = await createClient()
  const linhas: unknown[] = []
  // O banco devolve no máximo 1.000 linhas por consulta; um ano pode passar disso (clientes × 12 meses).
  for (let de = 0; de < 10000; de += 1000) {
    const { data, error } = await supabase
      .from('grade_pagamento_meses')
      .select('grade_id, mes, valor, status, observacoes')
      .gte('mes', `${ano}-01-01`).lte('mes', `${ano}-12-31`)
      .order('mes').order('grade_id')
      .range(de, de + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return NextResponse.json({ ano, registros: linhas })
}

export async function PUT(req: NextRequest) {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  const gradeId = String(body?.grade_id ?? '')
  const ym = String(body?.mes ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(gradeId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) {
    return NextResponse.json({ error: 'Cliente ou mês inválido.' }, { status: 400 })
  }
  if ('status' in body && !STATUS.includes(body.status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  let valor: number | null | undefined
  if ('valor' in body) {
    valor = body.valor === '' || body.valor === null ? null : Number(body.valor)
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
  }

  const supabase = await createClient()
  const mes = `${ym}-01`
  const { data: atual } = await supabase.from('grade_pagamento_meses').select('valor, status').eq('grade_id', gradeId).eq('mes', mes).maybeSingle()
  const { data, error } = await supabase
    .from('grade_pagamento_meses')
    .upsert({
      grade_id: gradeId,
      mes,
      valor: valor !== undefined ? valor : (atual?.valor ?? null),
      status: 'status' in body ? body.status : (atual?.status ?? 'pendente'),
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    }, { onConflict: 'grade_id,mes' })
    .select('grade_id, mes, valor, status, observacoes')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
