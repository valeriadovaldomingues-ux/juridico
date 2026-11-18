import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { lerDespesaPessoal } from '@/lib/financeiro/despesas-pessoais'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const r = lerDespesaPessoal(await req.json().catch(() => null))
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('despesas_pessoais_socios')
    .update({ ...r.dados, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Despesa não encontrada.' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const supabase = await createClient()
  const { error } = await supabase.from('despesas_pessoais_socios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
