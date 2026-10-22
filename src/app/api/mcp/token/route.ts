import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { gerarToken } from '@/lib/mcp/token'
import { usuarioPodeMcp } from '@/lib/mcp/permitidos'

// POST — gera uma chave pessoal (90 dias) para a pessoa logada, se ela estiver na lista do conector.
export async function POST() {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  if (!usuarioPodeMcp(auth.userId)) return NextResponse.json({ error: 'Seu usuário ainda não foi liberado para o conector.' }, { status: 403 })
  try {
    const { token, expiraEm } = gerarToken(auth.userId, { dias: 90 })
    console.info('[mcp] chave gerada', JSON.stringify({ usuario: auth.userId, expira_em: expiraEm.toISOString() }))
    return NextResponse.json({ token, expira_em: expiraEm.toISOString() })
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar a chave (segredo não configurado).' }, { status: 503 })
  }
}
