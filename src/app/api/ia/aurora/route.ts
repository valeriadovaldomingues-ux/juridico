import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { completarTexto, streamTextoPreflight } from '@/lib/ai/service'
import { buildMensagensAurora } from '@/lib/ai/prompts'
import type { AuroraMensagemHistorico } from '@/lib/ai/prompts'
import {
  buscarPublicacoesParaAurora,
  detectarIntencaoPublicacoes,
  montarContextoPublicacoesParaAurora,
} from '@/lib/ai/aurora-context'

const IS_DEV = process.env.NODE_ENV === 'development'

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Erro desconhecido'
}

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
    const intencaoPublicacoes = detectarIntencaoPublicacoes(mensagem)
    let contextoSistema: string | undefined

    if (intencaoPublicacoes.temIntencao) {
      try {
        const publicacoes = await buscarPublicacoesParaAurora({ ...intencaoPublicacoes, limit: 20 })
        contextoSistema = montarContextoPublicacoesParaAurora(publicacoes)
      } catch (contextErr) {
        const contextMsg = getErrorMessage(contextErr)
        if (IS_DEV) {
          console.error('[Aurora API] falha ao buscar contexto de publicações', contextErr)
        }
        contextoSistema = [
          'CONTEXTO DO SISTEMA - PUBLICAÇÕES',
          'A Aurora tentou consultar publicações reais do sistema, mas a consulta falhou.',
          `Erro técnico: ${contextMsg}`,
          'Não trate ausência de dados como ausência de publicações.',
        ].join('\n')
      }
    }

    const messages  = buildMensagensAurora(mensagem, historico, contextoSistema)

    let stream: ReadableStream<Uint8Array>
    try {
      stream = await streamTextoPreflight(messages, { maxTokens: 3072, temperature: 0.45 })
    } catch (streamErr) {
      const streamMsg = getErrorMessage(streamErr)
      if (IS_DEV) {
        console.error('[Aurora API] falha no preflight do streaming', streamErr)
      }

      try {
        const resposta = await completarTexto(messages, { maxTokens: 3072, temperature: 0.45 })
        return NextResponse.json({
          resposta,
          modo: 'json',
          aviso: `Streaming indisponível nesta requisição: ${streamMsg}`,
        })
      } catch (fallbackErr) {
        const fallbackMsg = getErrorMessage(fallbackErr)
        if (IS_DEV) {
          console.error('[Aurora API] falha no fallback sem streaming', fallbackErr)
        }
        return NextResponse.json(
          { error: `Erro ao chamar Aurora: ${fallbackMsg}` },
          { status: 500 },
        )
      }
    }

    return new Response(stream, {
      headers: {
        'Content-Type':           'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control':          'no-cache',
      },
    })
  } catch (err) {
    const msg = getErrorMessage(err)
    if (IS_DEV) {
      console.error('[Aurora API] erro antes de devolver resposta', err)
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
