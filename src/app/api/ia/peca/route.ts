import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { streamTexto } from '@/lib/ai/service'
import { buildMensagensPeca } from '@/lib/ai/prompts'
import type { DadosProcesso } from '@/lib/ai/prompts'

/**
 * POST /api/ia/peca
 * Gera uma peça jurídica via streaming.
 * Body: { tipoPeca: string; processo: DadosProcesso; instrucoes: string }
 */
export async function POST(request: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  let body: { tipoPeca: string; processo: DadosProcesso; instrucoes: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { tipoPeca, processo, instrucoes = '' } = body
  if (!tipoPeca || !processo) {
    return NextResponse.json({ error: 'tipoPeca e processo são obrigatórios' }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada. Adicione ao .env.local' },
      { status: 503 },
    )
  }

  try {
    const messages = buildMensagensPeca(tipoPeca, processo, instrucoes)
    const stream   = streamTexto(messages, { maxTokens: 4096, temperature: 0.6 })

    return new Response(stream, {
      headers: {
        'Content-Type':           'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control':          'no-cache',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao chamar IA'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
