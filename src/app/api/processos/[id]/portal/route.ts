import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { portalDb, tabelaAusente } from '@/lib/portal-cliente/db'
import { registrarLogPortal } from '@/lib/portal-cliente/log'
import { PORTAL_PAPEIS_GESTAO } from '@/lib/portal-cliente/constantes'
import { isUUID } from '@/lib/portal/validate'
import type { UserRole } from '@/types'

/**
 * PATCH /api/processos/[id]/portal  { ocultar_portal: boolean }
 * Interruptor "Ocultar do portal do cliente" da ficha do processo. Só quem gerencia o portal (hoje: sócio).
 * Se a coluna ainda não existe (migração do portal não aplicada), responde 409 com aviso claro, sem 500.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(PORTAL_PAPEIS_GESTAO as UserRole[])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Processo inválido.' }, { status: 404 })

  let corpo: { ocultar_portal?: unknown }
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }
  if (typeof corpo.ocultar_portal !== 'boolean') {
    return NextResponse.json({ error: 'ocultar_portal deve ser verdadeiro ou falso.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('processos')
    .update({ ocultar_portal: corpo.ocultar_portal })
    .eq('id', id)
    .select('id, ocultar_portal')
    .maybeSingle()

  if (error) {
    if (tabelaAusente(error)) {
      return NextResponse.json({ error: 'O portal do cliente ainda não foi ativado no banco de dados.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  try {
    await registrarLogPortal(portalDb(), {
      acao: corpo.ocultar_portal ? 'processo_ocultado' : 'processo_reexibido',
      processoId: id,
      usuarioId: auth.userId,
    })
  } catch {
    // log é best-effort
  }
  return NextResponse.json({ ok: true, ocultar_portal: data.ocultar_portal })
}
