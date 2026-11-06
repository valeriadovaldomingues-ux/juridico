import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MCP_PAPEIS_PERMITIDOS, usuarioPodeMcp } from '@/lib/mcp/permitidos'
import { origemPublica, urlRetorno, validarPedidoAutorizacao } from '@/lib/mcp/oauth'
import { criarConcessao } from '@/lib/mcp/oauth-concessoes'

// Chamada da tela de autorização (/oauth/authorize) quando a pessoa clica em "Autorizar" ou "Cancelar".
// Exige a sessão do PEDV; devolve o endereço para o navegador voltar ao Claude (com o código ou com o erro).
export async function POST(req: Request) {
  if (req.headers.get('origin') !== origemPublica(req)) return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sessão expirada. Entre no PEDV de novo.' }, { status: 401 })

  const corpo = await req.json().catch(() => null) as Record<string, unknown> | null
  const v = validarPedidoAutorizacao(corpo ?? {})
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })
  const { pedido } = v

  if (corpo?.decisao !== 'aprovar') {
    return NextResponse.json({ redirect: urlRetorno(pedido.redirectUri, pedido.state, { error: 'access_denied' }) })
  }

  if (!usuarioPodeMcp(user.id)) return NextResponse.json({ error: 'Seu usuário ainda não foi liberado para o conector.' }, { status: 403 })
  const db = createServiceClient()
  const { data: perfil } = await db.from('profiles').select('role, ativo').eq('id', user.id).maybeSingle()
  if (!perfil?.ativo || !(MCP_PAPEIS_PERMITIDOS as readonly string[]).includes(perfil.role)) {
    return NextResponse.json({ error: 'Conta inativa ou sem permissão.' }, { status: 403 })
  }

  const r = await criarConcessao(db, { userId: user.id, clientId: pedido.clientId, clientNome: pedido.clienteNome, redirectUri: pedido.redirectUri, codeChallenge: pedido.codeChallenge })
  if ('erro' in r) return NextResponse.json({ error: 'Não foi possível autorizar agora. Tente de novo.' }, { status: 500 })
  console.info('[mcp] oauth autorizado', JSON.stringify({ usuario: user.id, cliente: pedido.clienteNome }))
  return NextResponse.json({ redirect: urlRetorno(pedido.redirectUri, pedido.state, { code: r.codigo }) })
}
