import type {
  ComunicacaoInteligenteCanal,
  ComunicacaoInteligenteConteudo,
  ComunicacaoInteligenteStatus,
  ComunicacaoInteligenteTipo,
} from './types'

export const COMUNICACAO_TIPOS: ComunicacaoInteligenteTipo[] = ['relatorio', 'mensagem', 'atualizacao']
export const COMUNICACAO_CANAIS: ComunicacaoInteligenteCanal[] = ['portal', 'email', 'whatsapp']
export const COMUNICACAO_STATUS: ComunicacaoInteligenteStatus[] = ['pendente_aprovacao', 'em_edicao', 'aprovada', 'enviada', 'descartada']

export function normalizeComunicaoTipo(value?: string | null): ComunicacaoInteligenteTipo {
  const normalized = (value ?? '').trim().toLowerCase()
  return (COMUNICACAO_TIPOS.includes(normalized as ComunicacaoInteligenteTipo) ? normalized : 'relatorio') as ComunicacaoInteligenteTipo
}

export function normalizeComunicaoCanal(value?: string | null): ComunicacaoInteligenteCanal {
  const normalized = (value ?? '').trim().toLowerCase()
  return (COMUNICACAO_CANAIS.includes(normalized as ComunicacaoInteligenteCanal) ? normalized : 'portal') as ComunicacaoInteligenteCanal
}

export function normalizeComunicaoStatus(value?: string | null): ComunicacaoInteligenteStatus {
  const normalized = (value ?? '').trim().toLowerCase()
  return (COMUNICACAO_STATUS.includes(normalized as ComunicacaoInteligenteStatus) ? normalized : 'pendente_aprovacao') as ComunicacaoInteligenteStatus
}

export function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => normalizeString(item))
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

export function normalizeComunicacaoConteudo(input: unknown): ComunicacaoInteligenteConteudo {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return {
    resumoExecutivo: normalizeString(obj.resumoExecutivo ?? obj.resumo_executivo),
    oQueAconteceu: normalizeString(obj.oQueAconteceu ?? obj.o_que_aconteceu),
    oQueIssoSignifica: normalizeString(obj.oQueIssoSignifica ?? obj.o_que_isso_significa),
    proximosPassos: normalizeStringArray(obj.proximosPassos ?? obj.proximos_passos),
    acaoNecessariaCliente: normalizeString(obj.acaoNecessariaCliente ?? obj.acao_necessaria_cliente),
    mensagemCliente: normalizeString(obj.mensagemCliente ?? obj.mensagem_cliente),
    observacoesInternas: normalizeString(obj.observacoesInternas ?? obj.observacoes_internas),
    camposNaoEncontrados: normalizeStringArray(obj.camposNaoEncontrados ?? obj.campos_nao_encontrados),
    inconsistencias: normalizeStringArray(obj.inconsistencias),
  }
}

export function buildComunicaoTexto(conteudo: ComunicacaoInteligenteConteudo, titulo?: string) {
  const blocos = [
    titulo ? `Assunto: ${titulo}` : null,
    conteudo.resumoExecutivo ? `Resumo executivo:\n${conteudo.resumoExecutivo}` : null,
    conteudo.oQueAconteceu ? `O que aconteceu:\n${conteudo.oQueAconteceu}` : null,
    conteudo.oQueIssoSignifica ? `O que isso significa:\n${conteudo.oQueIssoSignifica}` : null,
    conteudo.proximosPassos.length > 0 ? `Próximos passos:\n${conteudo.proximosPassos.map(item => `- ${item}`).join('\n')}` : null,
    conteudo.acaoNecessariaCliente ? `Ação necessária do cliente:\n${conteudo.acaoNecessariaCliente}` : null,
    conteudo.observacoesInternas ? `Observações internas:\n${conteudo.observacoesInternas}` : null,
  ].filter(Boolean)

  return blocos.join('\n\n').trim()
}

