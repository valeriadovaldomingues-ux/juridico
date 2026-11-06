import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { listarAcessos, revogarAcesso } from '@/lib/mcp/oauth-acessos'

const UUID = /^[0-9a-f-]{36}$/i

// GET — acessos ativos do conector de todas as pessoas. Só sócios (Valéria e Cristiano) veem e revogam.
export async function GET() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  try {
    const acessos = await listarAcessos(createServiceClient(), {})
    return NextResponse.json({ acessos, todos: true })
  } catch {
    return NextResponse.json({ error: 'Não foi possível listar os acessos.' }, { status: 500 })
  }
}

// POST { id } — revoga um acesso: o Claude perde o acesso na próxima chamada. Só sócios.
export async function POST(req: Request) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 })
  const corpo = await req.json().catch(() => null) as { id?: unknown } | null
  const id = typeof corpo?.id === 'string' && UUID.test(corpo.id) ? corpo.id : null
  if (!id) return NextResponse.json({ error: 'Acesso inválido.' }, { status: 400 })
  try {
    const revogou = await revogarAcesso(createServiceClient(), id, {})
    if (!revogou) return NextResponse.json({ error: 'Acesso não encontrado ou já revogado.' }, { status: 404 })
    console.info('[mcp] acesso revogado', JSON.stringify({ por: auth.userId, acesso: id }))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Não foi possível revogar agora.' }, { status: 500 })
  }
}
