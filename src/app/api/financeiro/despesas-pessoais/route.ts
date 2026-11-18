import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { lerDespesaPessoal } from '@/lib/financeiro/despesas-pessoais'

// Despesas pessoais dos sócios: SÓ sócio (a tabela também tem RLS só para sócio).
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const r = lerDespesaPessoal(await req.json().catch(() => null))
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('despesas_pessoais_socios')
    .insert({ ...r.dados, criado_por: auth.userId })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
