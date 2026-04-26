import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { completarJSON } from '@/lib/ai/service'
import { buildMensagensAnaliseEstrategica } from '@/lib/ai/prompts'
import type { DadosProcesso, AnaliseEstrategica } from '@/lib/ai/prompts'

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 503 })
  }

  const { processo }: { processo: DadosProcesso } = await req.json()
  if (!processo) return NextResponse.json({ error: 'processo obrigatório' }, { status: 400 })

  try {
    const messages = buildMensagensAnaliseEstrategica(processo)
    const raw      = await completarJSON(messages, { temperature: 0.3, maxTokens: 2048 })
    const analise: AnaliseEstrategica = JSON.parse(raw)
    return NextResponse.json(analise)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao analisar processo' },
      { status: 500 },
    )
  }
}
