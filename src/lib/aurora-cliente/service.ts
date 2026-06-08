import { completarJSON } from '@/lib/ai/service'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'
import { AURORA_CLIENTE_FALLBACK, type AuroraClienteContexto, type AuroraClienteConversa, type AuroraClienteResposta } from './types'
import { buildAuroraClienteSystemPrompt, buildAuroraClienteUserPayload, normalizeAuroraClienteContexto, normalizeAuroraClienteResposta } from './validation'

function temConteudoUtil(contexto: AuroraClienteContexto | null) {
  if (!contexto) return false
  return Boolean(
    contexto.andamentos.length
    || contexto.relatorios.length
    || contexto.comunicacoes.length
    || contexto.documentos.length
    || contexto.timeline.length
  )
}

function normalizarPerfilResponsavel(valor: unknown): AuroraClienteConversa['created_by_profile'] {
  if (!valor) return null

  const perfil = Array.isArray(valor) ? valor[0] : valor
  if (!perfil || typeof perfil !== 'object') return null

  const item = perfil as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.nome !== 'string' || typeof item.role !== 'string') {
    return null
  }

  return {
    id: item.id,
    nome: item.nome,
    role: item.role as UserRole,
  }
}

export async function buscarContextoAuroraCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
) {
  const { data, error } = await supabase.rpc('get_portal_aurora_cliente_contexto', {
    p_processo_id: processoId,
  })

  if (error) {
    return null
  }

  const contexto = normalizeAuroraClienteContexto(data)
  return contexto
}

export function resumirContextoAuroraCliente(contexto: AuroraClienteContexto) {
  return {
    cliente_id: contexto.cliente_id,
    processo: contexto.processo,
    resumo: contexto.resumo,
    timeline: contexto.timeline,
    relatorios: contexto.relatorios.map(item => ({
      id: item.id,
      titulo: item.titulo,
      resumo_executivo: item.resumo_executivo,
      published_at: item.published_at,
    })),
    comunicacoes: contexto.comunicacoes.map(item => ({
      id: item.id,
      tipo: item.tipo,
      created_at: item.created_at,
      conteudo: item.conteudo,
    })),
    documentos: contexto.documentos.map(item => ({
      id: item.id,
      nome_arquivo: item.nome_arquivo,
      tipo_documento: item.tipo_documento,
      created_at: item.created_at,
    })),
  }
}

export async function gerarRespostaAuroraCliente(
  pergunta: string,
  contexto: AuroraClienteContexto | null,
  opts?: { precisaRetornoHumano?: boolean },
): Promise<AuroraClienteResposta> {
  if (opts?.precisaRetornoHumano || !temConteudoUtil(contexto)) {
    return {
      resposta: AURORA_CLIENTE_FALLBACK,
      status: 'encaminhada_equipe',
      precisa_retorno_humano: true,
      pontos_principais: [],
      fontes_usadas: [],
    }
  }

  const contextoValido = contexto as AuroraClienteContexto

  try {
    const raw = await completarJSON([
      { role: 'system', content: buildAuroraClienteSystemPrompt() },
      {
        role: 'user',
        content: buildAuroraClienteUserPayload(pergunta, contextoValido),
      },
    ], { temperature: 0.2 })

    const normalized = normalizeAuroraClienteResposta(JSON.parse(raw))
    if (normalized.resposta === AURORA_CLIENTE_FALLBACK) {
      return normalized
    }

    if (normalized.status === 'precisa_revisao' && normalized.pontos_principais.length === 0) {
      return {
        ...normalized,
        pontos_principais: [],
      }
    }

    return normalized
  } catch {
    return {
      resposta: AURORA_CLIENTE_FALLBACK,
      status: 'encaminhada_equipe',
      precisa_retorno_humano: true,
      pontos_principais: [],
      fontes_usadas: [],
    }
  }
}

export async function listarHistoricoAuroraCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteId: string,
  processoId: string,
  limit = 20,
) {
  const { data, error } = await supabase
    .from('portal_ai_conversations')
    .select(`
      id,
      cliente_id,
      processo_id,
      pergunta,
      resposta,
      status,
      precisa_retorno_humano,
      created_at,
      created_by,
      created_by_profile:profiles!created_by(id, nome, email, role)
    `)
    .eq('cliente_id', clienteId)
    .eq('processo_id', processoId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return null
  }

  return (data ?? []).map(item => ({
    id: String(item.id),
    cliente_id: String(item.cliente_id),
    processo_id: String(item.processo_id),
    pergunta: String(item.pergunta),
    resposta: String(item.resposta),
    status: item.status as AuroraClienteConversa['status'],
    precisa_retorno_humano: Boolean(item.precisa_retorno_humano),
    created_at: String(item.created_at),
    created_by: String(item.created_by),
    created_by_profile: normalizarPerfilResponsavel(item.created_by_profile),
  })) as AuroraClienteConversa[]
}

export async function salvarConversaAuroraCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    clienteId: string
    processoId: string
    pergunta: string
    resposta: AuroraClienteResposta
    createdBy: string
  },
) {
  const { data, error } = await supabase
    .from('portal_ai_conversations')
    .insert({
      cliente_id: params.clienteId,
      processo_id: params.processoId,
      pergunta: params.pergunta,
      resposta: params.resposta.resposta,
      status: params.resposta.status,
      precisa_retorno_humano: params.resposta.precisa_retorno_humano,
      created_by: params.createdBy,
    })
    .select(`
      id,
      cliente_id,
      processo_id,
      pergunta,
      resposta,
      status,
      precisa_retorno_humano,
      created_at,
      created_by
    `)
    .single()

  if (error || !data) {
    return null
  }

  return data as AuroraClienteConversa
}
