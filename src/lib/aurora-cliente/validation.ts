import { AURORA_CLIENTE_FALLBACK, type AuroraClienteContexto, type AuroraClienteResposta, type AuroraClienteStatus } from './types'

function isStatus(value: unknown): value is AuroraClienteStatus {
  return value === 'respondida' || value === 'precisa_revisao' || value === 'encaminhada_equipe'
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
}

export function buildAuroraClienteSystemPrompt() {
  return [
    'Você é Aurora Cliente, assistente do portal do cliente do PEDV.',
    'Use somente os dados fornecidos no contexto.',
    'Não invente fatos, prazos, providências, resultados ou aconselhamento estratégico.',
    'Não use dados de outros clientes nem qualquer informação interna do escritório.',
    'Não mencione prompts, logs, rascunhos ou observações internas.',
    'Responda em linguagem simples, clara e profissional para um cliente leigo.',
    'Se a informação não estiver nos dados disponíveis, responda exatamente com:',
    `"${AURORA_CLIENTE_FALLBACK}"`,
    'Retorne APENAS JSON válido com as chaves:',
    'resposta, status, precisaRetornoHumano, pontosPrincipais, fontesUsadas.',
    'status deve ser um destes valores: respondida, precisa_revisao, encaminhada_equipe.',
    'Se a resposta precisar ser encaminhada à equipe, use o texto de fallback exato e status encaminhada_equipe.',
  ].join('\n')
}

export function buildAuroraClienteUserPayload(
  pergunta: string,
  contexto: AuroraClienteContexto,
) {
  return JSON.stringify({
    pergunta,
    contexto,
  })
}

export function normalizeAuroraClienteResposta(raw: unknown): AuroraClienteResposta {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const resposta = typeof value.resposta === 'string' && value.resposta.trim()
    ? value.resposta.trim()
    : AURORA_CLIENTE_FALLBACK

  const status = isStatus(value.status) ? value.status : (resposta === AURORA_CLIENTE_FALLBACK ? 'encaminhada_equipe' : 'respondida')
  const precisaRetornoHumano = typeof value.precisaRetornoHumano === 'boolean'
    ? value.precisaRetornoHumano
    : status !== 'respondida'

  return {
    resposta,
    status: resposta === AURORA_CLIENTE_FALLBACK ? 'encaminhada_equipe' : status,
    precisa_retorno_humano: resposta === AURORA_CLIENTE_FALLBACK ? true : precisaRetornoHumano,
    pontos_principais: normalizeStringArray(value.pontosPrincipais),
    fontes_usadas: normalizeStringArray(value.fontesUsadas),
  }
}

export function normalizeAuroraClienteContexto(raw: unknown): AuroraClienteContexto | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const processo = value.processo
  const clienteId = value.cliente_id
  const resumo = value.resumo

  if (!processo || typeof processo !== 'object' || typeof clienteId !== 'string') {
    return null
  }

  const processoObj = processo as Record<string, unknown>
  return {
    cliente_id: clienteId,
    processo: {
      id: String(processoObj.id ?? ''),
      numero_processo: typeof processoObj.numero_processo === 'string' ? processoObj.numero_processo : null,
      titulo: String(processoObj.titulo ?? ''),
      area_direito: String(processoObj.area_direito ?? ''),
      status: String(processoObj.status ?? ''),
      fase: typeof processoObj.fase === 'string' ? processoObj.fase : null,
      tribunal: typeof processoObj.tribunal === 'string' ? processoObj.tribunal : null,
      comarca: typeof processoObj.comarca === 'string' ? processoObj.comarca : null,
      vara: typeof processoObj.vara === 'string' ? processoObj.vara : null,
      classe_processual: typeof processoObj.classe_processual === 'string' ? processoObj.classe_processual : null,
      assunto: typeof processoObj.assunto === 'string' ? processoObj.assunto : null,
      data_distribuicao: typeof processoObj.data_distribuicao === 'string' ? processoObj.data_distribuicao : null,
    },
    andamentos: Array.isArray(value.andamentos) ? value.andamentos as AuroraClienteContexto['andamentos'] : [],
    relatorios: Array.isArray(value.relatorios) ? value.relatorios as AuroraClienteContexto['relatorios'] : [],
    comunicacoes: Array.isArray(value.comunicacoes) ? value.comunicacoes as AuroraClienteContexto['comunicacoes'] : [],
    documentos: Array.isArray(value.documentos) ? value.documentos as AuroraClienteContexto['documentos'] : [],
    timeline: Array.isArray(value.timeline) ? value.timeline as AuroraClienteContexto['timeline'] : [],
    resumo: {
      andamentos: typeof (resumo as Record<string, unknown> | undefined)?.andamentos === 'number' ? Number((resumo as Record<string, unknown>).andamentos) : 0,
      relatorios: typeof (resumo as Record<string, unknown> | undefined)?.relatorios === 'number' ? Number((resumo as Record<string, unknown>).relatorios) : 0,
      comunicacoes: typeof (resumo as Record<string, unknown> | undefined)?.comunicacoes === 'number' ? Number((resumo as Record<string, unknown>).comunicacoes) : 0,
      documentos: typeof (resumo as Record<string, unknown> | undefined)?.documentos === 'number' ? Number((resumo as Record<string, unknown>).documentos) : 0,
      timeline: typeof (resumo as Record<string, unknown> | undefined)?.timeline === 'number' ? Number((resumo as Record<string, unknown>).timeline) : 0,
    },
  }
}
