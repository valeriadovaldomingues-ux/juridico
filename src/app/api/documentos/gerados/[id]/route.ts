import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('doc_gerados')
    .update({ titulo: body.titulo, conteudo: body.conteudo })
    .eq('id', id)
    .select('*, processo:processos(id, titulo, numero_processo), modelo:doc_modelos(nome)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('doc_gerados').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
