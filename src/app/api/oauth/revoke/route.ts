import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revogarPorRenovacao } from '@/lib/mcp/oauth-concessoes'

// Revogação (RFC 7009): o Claude chama ao desconectar o conector. Responde 200 sempre, como manda a norma.
export async function POST(req: Request) {
  const tipo = req.headers.get('content-type') ?? ''
  const token = tipo.includes('application/json')
    ? String(((await req.json().catch(() => ({}))) as { token?: unknown }).token ?? '')
    : new URLSearchParams(await req.text()).get('token') ?? ''
  if (token) {
    try { await revogarPorRenovacao(createServiceClient(), token) } catch { /* sem efeito para quem chama */ }
  }
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
