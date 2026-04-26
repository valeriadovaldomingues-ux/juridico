/**
 * PATCH /api/publicacoes/revisao
 * Atualiza status_revisao de uma publicação.
 * Nenhum prazo fatal é criado automaticamente — apenas sugestão permanece.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['advogado', 'gerente', 'socio']

export async function PATCH(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { id, status_revisao, nota } = body as {
    id:             string
    status_revisao: 'em_revisao' | 'aprovado' | 'descartado'
    nota?:          string
  }

  if (!id || !status_revisao) {
    return NextResponse.json({ error: 'id e status_revisao são obrigatórios' }, { status: 400 })
  }

  const VALIDOS = ['em_revisao', 'aprovado', 'descartado']
  if (!VALIDOS.includes(status_revisao)) {
    return NextResponse.json({ error: 'status_revisao inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('publicacoes')
    .update({
      status_revisao,
      revisado_por: auth.userId,
      revisado_em:  new Date().toISOString(),
      revisao_nota: nota ?? null,
      // Aprovado → marca como tratada; descartado → descarta
      ...(status_revisao === 'aprovado'   ? { status: 'nao_tratada' } : {}),
      ...(status_revisao === 'descartado' ? { status: 'descartada'  } : {}),
    })
    .eq('id', id)
    .select('id, status, status_revisao')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
