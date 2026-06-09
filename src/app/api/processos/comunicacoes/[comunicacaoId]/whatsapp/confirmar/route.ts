import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import {
  buildWhatsAppMensagem,
  mapComunicacaoDbRowToDraft,
  normalizeWhatsAppTelefone,
} from '@/lib/comunicacao-inteligente'
import type { UserRole } from '@/types'

const ALLOWED_ROLES: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

async function registrarLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comunicacaoId: string,
  acao: 'gerada' | 'editada' | 'aprovada' | 'enviada' | 'enviada_manual_whatsapp' | 'whatsapp_iniciado' | 'whatsapp_confirmado' | 'descartada',
  realizadoPor: string,
  detalhes: Record<string, unknown>,
) {
  await supabase.from('comunicacoes_inteligentes_logs').insert({
    comunicacao_id: comunicacaoId,
    acao,
    detalhes,
    realizado_por: realizadoPor,
  })
}

function buildMensagemErro(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function carregarContexto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comunicacaoId: string,
) {
  const { data: comunicacao, error: comunicacaoError } = await supabase
    .from('comunicacoes_inteligentes')
    .select('*')
    .eq('id', comunicacaoId)
    .single()

  if (comunicacaoError || !comunicacao) {
    return { error: buildMensagemErro('Comunicação não encontrada', 404) }
  }

  if (comunicacao.status !== 'aprovada') {
    return { error: buildMensagemErro('A comunicação precisa estar aprovada antes da confirmação do WhatsApp', 409) }
  }

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('id, nome, celular, telefone')
    .eq('id', comunicacao.cliente_id)
    .single()

  if (clienteError || !cliente) {
    return { error: buildMensagemErro('Cliente não encontrado', 404) }
  }

  return { comunicacao, cliente }
}

function validarTelefoneSelecionado(telefonesPermitidos: Array<string | null | undefined>, telefoneInformado: string) {
  const telefoneNormalizado = normalizeWhatsAppTelefone(telefoneInformado)
  const telefonesValidos = telefonesPermitidos
    .map(telefone => normalizeWhatsAppTelefone(telefone ?? ''))
    .filter(Boolean)

  if (!telefonesValidos.length) return { error: 'Nenhum telefone disponível para confirmação via WhatsApp.' }
  if (!telefoneNormalizado) return { error: 'Telefone inválido.' }
  if (!telefonesValidos.includes(telefoneNormalizado)) {
    return { error: 'Telefone informado não pertence ao cliente ou ao contato selecionado.' }
  }

  return { telefone: telefoneNormalizado }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ comunicacaoId: string }> },
) {
  const auth = await apiGuard(ALLOWED_ROLES)
  if (auth instanceof NextResponse) return auth

  const { comunicacaoId } = await params
  if (!comunicacaoId) {
    return NextResponse.json({ error: 'ID da comunicação ausente' }, { status: 400 })
  }

  let body: { destinatario_tipo?: string; contato_id?: string | null; telefone?: string | null }
  try {
    body = await request.json()
  } catch {
    return buildMensagemErro('Payload inválido')
  }

  const supabase = await createClient()
  const contexto = await carregarContexto(supabase, comunicacaoId)
  if ('error' in contexto) return contexto.error

  const { comunicacao, cliente } = contexto
  const destinatarioTipo = body.destinatario_tipo === 'contato' ? 'contato' : 'cliente'

  let contato: { id: string; nome: string; celular: string | null; ativo: boolean } | null = null
  const telefonesPermitidos: Array<string | null | undefined> = [cliente.celular, cliente.telefone]

  if (destinatarioTipo === 'contato') {
    if (!body.contato_id) {
      return buildMensagemErro('Contato não informado.')
    }

    const { data, error } = await supabase
      .from('cliente_contatos')
      .select('id, nome, celular, ativo, cliente_id')
      .eq('cliente_id', comunicacao.cliente_id)
      .eq('id', body.contato_id)
      .single()

    if (error || !data) {
      return buildMensagemErro('Contato não encontrado.', 404)
    }
    if (!data.ativo) {
      return buildMensagemErro('Contato inativo não pode confirmar WhatsApp.', 409)
    }
    if (!data.celular) {
      return buildMensagemErro('Contato sem celular cadastrado.', 400)
    }

    contato = data
    telefonesPermitidos.push(data.celular)
  }

  const telefoneValidacao = validarTelefoneSelecionado(telefonesPermitidos, body.telefone ?? '')
  const telefoneErro = 'error' in telefoneValidacao ? telefoneValidacao.error : null
  if (telefoneErro) {
    return buildMensagemErro(telefoneErro)
  }
  const telefoneSelecionado = telefoneValidacao.telefone as string

  const draft = mapComunicacaoDbRowToDraft(comunicacao as Parameters<typeof mapComunicacaoDbRowToDraft>[0])
  const mensagem = buildWhatsAppMensagem(draft)

  const { data, error } = await supabase
    .from('comunicacoes_inteligentes')
    .update({
      status: 'enviada_manual_whatsapp',
      canal_destino: 'whatsapp',
      enviado_por: auth.userId,
      enviado_em: new Date().toISOString(),
      atualizado_por: auth.userId,
      conteudo_texto: draft.conteudo_texto || mensagem,
    })
    .eq('id', comunicacaoId)
    .select(`
      *,
      criado_por_profile:profiles!criado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      enviado_por_profile:profiles!enviado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return buildMensagemErro(error?.message ?? 'Falha ao confirmar envio do WhatsApp')
  }

  await registrarLog(supabase, comunicacaoId, 'enviada_manual_whatsapp', auth.userId, {
    destinatario_tipo: destinatarioTipo,
    contato_id: contato?.id ?? null,
    telefone: telefoneSelecionado,
  })

  return NextResponse.json(
    mapComunicacaoDbRowToDraft(data as Parameters<typeof mapComunicacaoDbRowToDraft>[0]),
  )
}
