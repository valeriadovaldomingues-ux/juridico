import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exigirSocios, lerJson, respostaErroBanco } from '@/lib/crm-socios/api'
import { TABELA_PROPOSTAS } from '@/lib/crm-socios/constants'
import { ehUUID, lerProposta } from '@/lib/crm-socios/validacao'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/crm-socios/propostas/[id]
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!ehUUID(id)) return NextResponse.json({ error: 'Proposta inválida.' }, { status: 400 })

  const lido = lerProposta(await lerJson(req), 'editar')
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 })
  if (Object.keys(lido.dados).length === 0) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABELA_PROPOSTAS)
    .update(lido.dados)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return respostaErroBanco(error, 'Não foi possível salvar a proposta.')
  if (!data) return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE /api/crm-socios/propostas/[id]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await exigirSocios()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!ehUUID(id)) return NextResponse.json({ error: 'Proposta inválida.' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from(TABELA_PROPOSTAS).delete().eq('id', id)
  if (error) return respostaErroBanco(error, 'Não foi possível excluir a proposta.')
  return NextResponse.json({ ok: true })
}
