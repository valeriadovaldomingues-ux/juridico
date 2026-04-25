import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('doc_modelos')
    .insert({
      nome:           body.nome,
      area_direito:   body.area_direito  || null,
      tipo_documento: body.tipo_documento || 'peticao_inicial',
      descricao:      body.descricao     || null,
      conteudo:       body.conteudo      || '',
      criado_por:     auth.userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
