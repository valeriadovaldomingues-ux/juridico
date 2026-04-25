import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('doc_gerados')
    .insert({
      modelo_id:   body.modelo_id   || null,
      processo_id: body.processo_id,
      titulo:      body.titulo,
      conteudo:    body.conteudo,
      criado_por:  auth.userId,
    })
    .select('*, processo:processos(id, titulo, numero_processo), modelo:doc_modelos(nome)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
