import type { RelatorioConteudo, RelatorioStatus } from './types'

export const RELATORIO_STATUS: RelatorioStatus[] = ['rascunho', 'pendente_aprovacao', 'aprovado', 'publicado', 'arquivado']

export const RELATORIO_STATUS_LABELS: Record<RelatorioStatus, string> = {
  rascunho: 'Rascunho',
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
}

export function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

export function normalizeRelatorioStatus(value?: string | null): RelatorioStatus {
  const normalized = normalizeString(value).toLowerCase() as RelatorioStatus
  return RELATORIO_STATUS.includes(normalized) ? normalized : 'rascunho'
}

export function normalizeRelatorioConteudo(input: unknown): RelatorioConteudo {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return {
    resumoExecutivo: normalizeString(obj.resumoExecutivo ?? obj.resumo_executivo),
    principaisMovimentacoes: normalizeStringArray(obj.principaisMovimentacoes ?? obj.principais_movimentacoes),
    situacaoAtual: normalizeString(obj.situacaoAtual ?? obj.situacao_atual),
    oQueIssoSignifica: normalizeString(obj.oQueIssoSignifica ?? obj.o_que_isso_significa),
    proximosPassos: normalizeStringArray(obj.proximosPassos ?? obj.proximos_passos),
    providenciasCliente: normalizeString(obj.providenciasCliente ?? obj.providencias_cliente),
  }
}

export function buildRelatorioTexto(conteudo: RelatorioConteudo, titulo?: string) {
  const blocos = [
    titulo ? `Assunto: ${titulo}` : null,
    conteudo.resumoExecutivo ? `RESUMO EXECUTIVO\n${conteudo.resumoExecutivo}` : null,
    conteudo.principaisMovimentacoes.length > 0
      ? `PRINCIPAIS MOVIMENTAÇÕES\n${conteudo.principaisMovimentacoes.map(item => `- ${item}`).join('\n')}`
      : null,
    conteudo.situacaoAtual ? `SITUAÇÃO ATUAL\n${conteudo.situacaoAtual}` : null,
    conteudo.oQueIssoSignifica ? `O QUE ISSO SIGNIFICA\n${conteudo.oQueIssoSignifica}` : null,
    conteudo.proximosPassos.length > 0
      ? `PRÓXIMOS PASSOS\n${conteudo.proximosPassos.map(item => `- ${item}`).join('\n')}`
      : null,
    `PROVIDÊNCIAS DO CLIENTE\n${conteudo.providenciasCliente || 'Nenhuma providência é necessária neste momento.'}`,
  ].filter(Boolean)

  return blocos.join('\n\n').trim()
}

export function buildRelatorioPeriodoLabel(inicio?: string | null, fim?: string | null) {
  const formatar = (value?: string | null) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
  }

  const textoInicio = formatar(inicio)
  const textoFim = formatar(fim)
  if (textoInicio && textoFim) return `${textoInicio} a ${textoFim}`
  if (textoInicio) return `A partir de ${textoInicio}`
  if (textoFim) return `Até ${textoFim}`
  return 'Todo o período'
}

