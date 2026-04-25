import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { completarJSON } from '@/lib/ai/service'
import { buildMensagensPublicacao } from '@/lib/ai/prompts'
import type { AnalisePublicacao } from '@/lib/ai/prompts'

/**
 * POST /api/ia/publicacao
 * Analisa uma publicação jurídica e retorna estrutura JSON.
 * Body: { textoPublicacao: string; numeroProcesso?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  let body: { textoPublicacao: string; numeroProcesso?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { textoPublicacao, numeroProcesso } = body
  if (!textoPublicacao?.trim()) {
    return NextResponse.json({ error: 'textoPublicacao é obrigatório' }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada. Adicione ao .env.local' },
      { status: 503 },
    )
  }

  try {
    const messages = buildMensagensPublicacao(textoPublicacao, numeroProcesso)
    const raw      = await completarJSON(messages)
    const analise: AnalisePublicacao = JSON.parse(raw)
    return NextResponse.json(analise)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao analisar publicação'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
