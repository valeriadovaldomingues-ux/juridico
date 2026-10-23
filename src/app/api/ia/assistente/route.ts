import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { streamTexto } from '@/lib/ai/service'
import { iaConfigurada } from '@/lib/ai/config'
import { buildMensagensAssistente } from '@/lib/ai/prompts'
import type { DadosProcesso } from '@/lib/ai/prompts'

/**
 * POST /api/ia/assistente
 * Responde uma pergunta jurídica via streaming.
 * Body: { pergunta: string; contextoProcesso?: DadosProcesso }
 */
export async function POST(request: NextRequest) {
  const auth = await apiGuard(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  let body: { pergunta: string; contextoProcesso?: DadosProcesso }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { pergunta, contextoProcesso } = body
  if (!pergunta?.trim()) {
    return NextResponse.json({ error: 'pergunta é obrigatória' }, { status: 400 })
  }

  if (!iaConfigurada()) {
    return NextResponse.json(
      { error: 'Chave de IA não configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY). Adicione nas variáveis de ambiente.' },
      { status: 503 },
    )
  }

  try {
    const messages = buildMensagensAssistente(pergunta, contextoProcesso)
    const stream   = streamTexto(messages, { maxTokens: 2048, temperature: 0.5 })

    return new Response(stream, {
      headers: {
        'Content-Type':           'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control':          'no-cache',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro no assistente'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
