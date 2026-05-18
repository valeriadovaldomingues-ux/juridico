import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { streamTexto } from '@/lib/ai/service'
import { buildMensagensAurora } from '@/lib/ai/prompts'
import type { AuroraMensagemHistorico } from '@/lib/ai/prompts'

/**
 * POST /api/ia/aurora
 * Assistente executiva jurídica interna, exclusiva para sócios.
 * Body: { mensagem: string; historico?: AuroraMensagemHistorico[] }
 */
export async function POST(request: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  let body: { mensagem?: string; historico?: AuroraMensagemHistorico[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const mensagem = body.mensagem?.trim()
  if (!mensagem) {
    return NextResponse.json({ error: 'mensagem é obrigatória' }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY && !process.env.AI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY ou AI_API_KEY não configurada. Adicione ao .env.local' },
      { status: 503 },
    )
  }

  try {
    const historico = Array.isArray(body.historico) ? body.historico : []
    const messages  = buildMensagensAurora(mensagem, historico)
    const stream    = streamTexto(messages, { maxTokens: 3072, temperature: 0.45 })

    return new Response(stream, {
      headers: {
        'Content-Type':           'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control':          'no-cache',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao chamar Aurora'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
