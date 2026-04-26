import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['advogado', 'gerente', 'socio']
const SOCIOS: UserRole[]  = ['gerente', 'socio']

/** GET /api/ia/pecas/[id] — conteúdo completo de uma peça */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ia_pecas')
    .select('*, gerado_por:profiles!gerado_por(id, nome), revisado_por:profiles!revisado_por(id, nome)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

/**
 * PATCH /api/ia/pecas/[id]
 * Aceita:
 *   { status: 'revisao' }                     → advogado envia para revisão
 *   { status: 'aprovada', comentario?: '' }   → sócio/gerente aprova
 *   { status: 'rejeitada', comentario: '...' } → sócio/gerente rejeita
 *   { conteudo: '...' }                        → atualiza conteúdo (só rascunho)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()
  const supabase = await createClient()

  // Busca a peça para validação
  const { data: peca } = await supabase.from('ia_pecas').select('status').eq('id', id).single()
  if (!peca) return NextResponse.json({ error: 'Peça não encontrada' }, { status: 404 })

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status === 'revisao') {
    // Qualquer advogado pode enviar para revisão
    if (peca.status !== 'rascunho' && peca.status !== 'rejeitada') {
      return NextResponse.json({ error: 'Apenas rascunhos ou rejeitadas podem ser enviadas para revisão' }, { status: 400 })
    }
    upd.status = 'revisao'
  } else if (body.status === 'aprovada' || body.status === 'rejeitada') {
    // Apenas gerente/sócio pode aprovar ou rejeitar
    if (!SOCIOS.includes(auth.role)) {
      return NextResponse.json({ error: 'Apenas gerentes e sócios podem aprovar ou rejeitar peças' }, { status: 403 })
    }
    upd.status             = body.status
    upd.revisado_por       = auth.userId
    upd.revisao_comentario = body.comentario ?? null
  } else if (body.conteudo !== undefined) {
    if (peca.status !== 'rascunho') {
      return NextResponse.json({ error: 'Somente rascunhos podem ser editados' }, { status: 400 })
    }
    upd.conteudo = body.conteudo
  } else {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase.from('ia_pecas').update(upd).eq('id', id).select('id, status, updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE /api/ia/pecas/[id] — apenas rascunhos pelo próprio advogado, ou sócio */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()

  const { data: peca } = await supabase.from('ia_pecas').select('status, gerado_por').eq('id', id).single()
  if (!peca) return NextResponse.json({ error: 'Peça não encontrada' }, { status: 404 })

  const podeExcluir = SOCIOS.includes(auth.role) ||
    (peca.status === 'rascunho' && peca.gerado_por === auth.userId)

  if (!podeExcluir) {
    return NextResponse.json({ error: 'Sem permissão para excluir esta peça' }, { status: 403 })
  }

  await supabase.from('ia_pecas').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
