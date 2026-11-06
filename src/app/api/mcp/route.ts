import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validarToken } from '@/lib/mcp/token'
import { desafioBearer, origemPublica, pareceTokenAcesso, validarTokenAcesso } from '@/lib/mcp/oauth'
import { concessaoAtiva } from '@/lib/mcp/oauth-concessoes'
import { MCP_PAPEIS_PERMITIDOS, usuarioPodeEscreverMcp, usuarioPodeMcp } from '@/lib/mcp/permitidos'
import { responderMcp } from '@/lib/mcp/protocolo'

// Conector MCP do PEDV. Duas formas de entrar (Bearer): o token do login OAuth (claude.ai, celular, nuvem) ou a chave
// pessoal gerada em /conectar-claude (Claude Desktop). Rota pública para o proxy (o Claude não tem sessão do navegador);
// toda chamada exige credencial válida e o usuário na lista. Sem credencial, o 401 aponta para o login (RFC 9728).
export const maxDuration = 60

const naoAutorizado = (req: Request, msg: string, erro?: string) =>
  NextResponse.json({ error: msg }, { status: 401, headers: { 'WWW-Authenticate': desafioBearer(origemPublica(req), erro) } })

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (!token) return naoAutorizado(req, 'Faça o login do conector.')

  let db: ReturnType<typeof createServiceClient>
  try { db = createServiceClient() } catch { return NextResponse.json({ error: 'Conector não configurado.' }, { status: 503 }) }
  let validacao: { ok: true; userId: string } | { ok: false; motivo: string }
  try {
    if (pareceTokenAcesso(token)) {
      const t = validarTokenAcesso(token)
      validacao = t.ok && await concessaoAtiva(db, t.concessaoId, t.userId) ? { ok: true, userId: t.userId } : { ok: false, motivo: t.ok ? 'revogada' : t.motivo }
    } else {
      validacao = validarToken(token)
    }
  } catch { return NextResponse.json({ error: 'Conector não configurado.' }, { status: 503 }) }
  if (!validacao.ok) return naoAutorizado(req, `Acesso inválido (${validacao.motivo}). Reconecte o conector.`, 'invalid_token')
  if (!usuarioPodeMcp(validacao.userId)) return NextResponse.json({ error: 'Este usuário não está liberado para o conector.' }, { status: 403 })

  const { data: perfil } = await db.from('profiles').select('nome, role, ativo').eq('id', validacao.userId).maybeSingle()
  if (!perfil?.ativo || !(MCP_PAPEIS_PERMITIDOS as readonly string[]).includes(perfil.role)) {
    return NextResponse.json({ error: 'Conta inativa ou sem permissão.' }, { status: 403 })
  }

  const corpo = await req.json().catch(() => null)
  if (!corpo) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }, { status: 400 })

  const ctx = { db, userId: validacao.userId, nome: String(perfil.nome ?? ''), podeEscrever: usuarioPodeEscreverMcp(validacao.userId) }
  // Registro de auditoria: quem consultou o quê (aparece nos logs da Vercel).
  const auditar = (e: { ferramenta: string; args: unknown; ms: number; ok: boolean }) =>
    console.info('[mcp]', JSON.stringify({ usuario: validacao.userId, nome: ctx.nome, ...e, args: JSON.stringify(e.args).slice(0, 300) }))

  const lote = Array.isArray(corpo) ? corpo : [corpo]
  const respostas = (await Promise.all(lote.map(m => responderMcp(m, ctx, auditar)))).filter(r => r !== null)
  if (respostas.length === 0) return new NextResponse(null, { status: 202 })
  return NextResponse.json(Array.isArray(corpo) ? respostas : respostas[0])
}

// Sem streaming (SSE): o cliente usa só POST.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
