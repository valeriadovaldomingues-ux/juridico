import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { completarTexto, streamTextoPreflight } from '@/lib/ai/service'
import { buildMensagensAurora } from '@/lib/ai/prompts'
import type { AuroraMensagemHistorico } from '@/lib/ai/prompts'
import { detectarIntencaoPublicacoes, buscarPublicacoesParaAurora, montarContextoPublicacoesParaAurora } from '@/lib/ai/aurora-context'
import {
  carregarPromptCompletoAurora,
} from '@/lib/aurora/prompt-loader'
import { AuroraAccessError, exigirAuroraSocio } from '@/lib/aurora/security'
import { classificarMensagemAurora } from '@/lib/aurora/router'
import type { AuroraExecucaoModo } from '@/lib/aurora/types'

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
  try {
    exigirAuroraSocio(auth.role)
  } catch (err) {
    if (err instanceof AuroraAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

  let body: { mensagem?: string; historico?: AuroraMensagemHistorico[]; modo?: AuroraExecucaoModo }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const modo: AuroraExecucaoModo = body.modo === 'profundo' ? 'profundo' : 'rapido'

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
    const historico = Array.isArray(body.historico) ? body.historico.slice(-4) : []
    const historicoRecente = historico.slice(-2).map(msg => msg.content)
    const decisao = classificarMensagemAurora({
      mensagem,
      historicoRecente,
      modo,
      role: auth.role,
    })
    const promptSistema = await carregarPromptCompletoAurora(decisao.agentId, modo, auth.role)
    let contextoSistema: string | undefined

    if (decisao.agentId === 'stella') {
      try {
        const intencaoPublicacoes = detectarIntencaoPublicacoes(mensagem)
        if (intencaoPublicacoes.temIntencao) {
          const publicacoes = await buscarPublicacoesParaAurora({ ...intencaoPublicacoes, limit: 20 })
          contextoSistema = montarContextoPublicacoesParaAurora(publicacoes)
        }
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

    const messages  = buildMensagensAurora(mensagem, historico, contextoSistema, promptSistema)

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
          agente: decisao.agentId,
          routingReason: decisao.reason,
          explicitLabel: decisao.explicitLabel ?? null,
          explicitValid: decisao.explicitValid ?? false,
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
        'X-Aurora-Agent':         decisao.agentId,
        'X-Aurora-Routing':       decisao.reason,
        'X-Aurora-Explicit':      decisao.explicitLabel ?? '',
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
