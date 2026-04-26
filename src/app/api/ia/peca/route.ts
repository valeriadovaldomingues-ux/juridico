import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { streamTexto } from '@/lib/ai/service'
import { buildMensagensPeca } from '@/lib/ai/prompts'
import type { DadosProcesso, AnaliseEstrategica } from '@/lib/ai/prompts'

/**
 * POST /api/ia/peca
 * Gera uma peça jurídica premium via streaming.
 * Body: { tipoPeca, processo, instrucoes, analise? }
 * Inclui análise estratégica no contexto do prompt quando disponível.
 */
export async function POST(request: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada.' }, { status: 503 })
  }

  let body: {
    tipoPeca:  string
    processo:  DadosProcesso
    instrucoes?: string
    analise?:  AnaliseEstrategica | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { tipoPeca, processo, instrucoes = '', analise = null } = body
  if (!tipoPeca || !processo) {
    return NextResponse.json({ error: 'tipoPeca e processo são obrigatórios' }, { status: 400 })
  }

  try {
    const messages = buildMensagensPeca(tipoPeca, processo, instrucoes, analise)
    const stream   = streamTexto(messages, { maxTokens: 8192, temperature: 0.65 })

    return new Response(stream, {
      headers: {
        'Content-Type':           'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control':          'no-cache',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao chamar IA' }, { status: 500 })
  }
}
