import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { completarTexto, streamTextoPreflight } from '@/lib/ai/service'
import { buildMensagensAurora } from '@/lib/ai/prompts'
import type { AuroraMensagemHistorico } from '@/lib/ai/prompts'
import { detectarIntencaoPublicacoes, buscarPublicacoesParaAurora, montarContextoPublicacoesParaAurora } from '@/lib/ai/aurora-context'
import { consultarOlavoDrive, montarContextoOlavoDrive } from '@/lib/aurora/olavo-drive'
import { AURORA_ANEXO_CONVERSA_CATEGORIA, mapearAuroraAnexo, montarContextoAnexosAurora } from '@/lib/aurora/anexos'
import {
  carregarPromptCompletoAurora,
} from '@/lib/aurora/prompt-loader'
import { AuroraAccessError, exigirAuroraSocio } from '@/lib/aurora/security'
import { classificarMensagemAurora } from '@/lib/aurora/router'
import type { AuroraExecucaoModo } from '@/lib/aurora/types'
import { createPasta, isCentralArquivosError, listPastas, uploadCentralArquivos } from '@/lib/central-arquivos'
import type { CentralArquivosPasta } from '@/lib/central-arquivos'

const IS_DEV = process.env.NODE_ENV === 'development'

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Erro desconhecido'
}

type AuroraBodyJson = {
  mensagem?: string
  historico?: AuroraMensagemHistorico[]
  modo?: AuroraExecucaoModo
  salvarAnexosNoDossie?: boolean
}

interface AuroraAnexosProcessados {
  anexosContexto?: string
  mensagem?: string
  historico?: AuroraMensagemHistorico[]
  modo?: AuroraExecucaoModo
  salvarAnexosNoDossie?: boolean
}

function isMultipartForm(request: NextRequest) {
  return request.headers.get('content-type')?.includes('multipart/form-data') ?? false
}

function parseHistorico(raw: FormDataEntryValue | null) {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseBoolean(raw: FormDataEntryValue | null) {
  if (typeof raw !== 'string') return false
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

async function ensureAuroraDossieFolder(userId: string): Promise<CentralArquivosPasta> {
  const pastas = await listPastas({ q: 'Anexos da Aurora', limit: 20 })
  const existente = pastas.find(pasta => pasta.nome === 'Anexos da Aurora' && pasta.pasta_pai_id === null)
  if (existente) return existente

  return createPasta(
    {
      nome: 'Anexos da Aurora',
      descricao: 'Arquivos anexados às conversas com a Aurora e salvos no Dossiê Aurora.',
      visibilidade: 'interna',
    },
    userId,
  )
}

async function processarAnexosDaAurora(
  request: NextRequest,
  userId: string,
): Promise<AuroraAnexosProcessados> {
  if (!isMultipartForm(request)) {
    return { anexosContexto: undefined as string | undefined, mensagem: undefined as string | undefined, historico: undefined as AuroraMensagemHistorico[] | undefined, modo: undefined as AuroraExecucaoModo | undefined }
  }

  const form = await request.formData()
  const mensagem = String(form.get('mensagem') ?? '').trim()
  const modo: AuroraExecucaoModo = form.get('modo') === 'profundo' ? 'profundo' : 'rapido'
  const historico = parseHistorico(form.get('historico'))
  const salvarAnexosNoDossie = parseBoolean(form.get('salvarAnexosNoDossie'))
  const anexos = [
    ...form.getAll('anexos'),
    ...form.getAll('files'),
  ].filter((item): item is File => item instanceof File)

  if (!anexos.length) {
    return { anexosContexto: undefined, mensagem, historico, modo, salvarAnexosNoDossie }
  }

  const pastaAurora = salvarAnexosNoDossie ? await ensureAuroraDossieFolder(userId) : null
  const documentos = await uploadCentralArquivos({
    files: anexos,
    pasta_id: pastaAurora?.id ?? null,
    categoria: AURORA_ANEXO_CONVERSA_CATEGORIA,
    descricao: 'Anexos enviados na conversa com a Aurora.',
    visibilidade: 'interna',
  }, userId)

  const anexosContexto = montarContextoAnexosAurora(
    documentos.map(documento => mapearAuroraAnexo(documento)),
    salvarAnexosNoDossie,
  )

  return {
    anexosContexto,
    mensagem,
    historico,
    modo,
    salvarAnexosNoDossie,
  }
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

  let body: AuroraBodyJson = {}
  let anexosContexto: string | undefined

  if (isMultipartForm(request)) {
    try {
      const parsed = await processarAnexosDaAurora(request, auth.userId)
      body = {
        mensagem: parsed.mensagem,
        historico: parsed.historico,
        modo: parsed.modo,
        salvarAnexosNoDossie: parsed.salvarAnexosNoDossie,
      }
      anexosContexto = parsed.anexosContexto
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar anexos.'
      const status = isCentralArquivosError(error) ? error.status : 500
      return NextResponse.json({ error: message }, { status })
    }
  } else {
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
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
    const blocosContexto: string[] = []

    if (decisao.agentId === 'olavo') {
      try {
        const respostaEspecialista = await consultarOlavoDrive(mensagem)
        blocosContexto.push(montarContextoOlavoDrive(respostaEspecialista))
      } catch (contextErr) {
        const contextMsg = getErrorMessage(contextErr)
        if (IS_DEV) {
          console.error('[Aurora API] falha ao consultar Olavo Drive', contextErr)
        }
        blocosContexto.push([
          'CONTEXTO DO SISTEMA - OLAVO DRIVE',
          'A Aurora tentou consultar o Olavo Drive, mas a consulta falhou.',
          `Erro técnico: ${contextMsg}`,
          'Continue a análise com base no seu conhecimento jurídico.',
        ].join('\n'))
      }
    }

    if (decisao.agentId === 'stella') {
      try {
        const intencaoPublicacoes = detectarIntencaoPublicacoes(mensagem)
        if (intencaoPublicacoes.temIntencao) {
          const publicacoes = await buscarPublicacoesParaAurora({ ...intencaoPublicacoes, limit: 20 })
          blocosContexto.push(montarContextoPublicacoesParaAurora(publicacoes))
        }
      } catch (contextErr) {
        const contextMsg = getErrorMessage(contextErr)
        if (IS_DEV) {
          console.error('[Aurora API] falha ao buscar contexto de publicações', contextErr)
        }
        blocosContexto.push([
          'CONTEXTO DO SISTEMA - PUBLICAÇÕES',
          'A Aurora tentou consultar publicações reais do sistema, mas a consulta falhou.',
          `Erro técnico: ${contextMsg}`,
          'Não trate ausência de dados como ausência de publicações.',
        ].join('\n'))
      }
    }

    if (anexosContexto) {
      blocosContexto.push(anexosContexto)
    }

    const contextoSistema = blocosContexto.length ? blocosContexto.join('\n\n') : undefined
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
