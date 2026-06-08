import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { checkContentLength, checkStringLength, isUUID, LIMITS } from '@/lib/portal/validate'
import { buscarContextoAuroraCliente, gerarRespostaAuroraCliente, salvarConversaAuroraCliente } from '@/lib/aurora-cliente'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const sizeError = checkContentLength(request)
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 })
  }

  const { id } = await params
  if (!isUUID(id)) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  let body: { pergunta?: string; precisaRetornoHumano?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const pergunta = body.pergunta?.trim() ?? ''
  if (!pergunta) {
    return NextResponse.json({ error: 'Pergunta obrigatória' }, { status: 400 })
  }

  const perguntaError = checkStringLength(pergunta, LIMITS.MENSAGEM_CHARS, 'pergunta')
  if (perguntaError) {
    return NextResponse.json({ error: perguntaError }, { status: 400 })
  }

  const supabase = await createClient()
  const contexto = await buscarContextoAuroraCliente(supabase, id)

  if (!contexto) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  const resposta = await gerarRespostaAuroraCliente(pergunta, contexto, {
    precisaRetornoHumano: Boolean(body.precisaRetornoHumano),
  })

  const conversa = await salvarConversaAuroraCliente(supabase, {
    clienteId: session.clienteId,
    processoId: id,
    pergunta,
    resposta,
    createdBy: session.userId,
  })

  if (!conversa) {
    return NextResponse.json({ error: 'Erro ao registrar pergunta' }, { status: 500 })
  }

  return NextResponse.json({
    conversation: {
      ...conversa,
      resposta: resposta.resposta,
      status: resposta.status,
      precisa_retorno_humano: resposta.precisa_retorno_humano,
    },
    resposta: resposta.resposta,
    status: resposta.status,
  }, { status: 201 })
}
