import type { AndamentoOrigem, AndamentoTipo, ProcessoAndamento, UserRole } from '@/types'

export const ANDAMENTO_ORIGENS: AndamentoOrigem[] = ['manual', 'tribunal', 'publicacao', 'sistema', 'aurora']

export const ANDAMENTO_TIPOS: AndamentoTipo[] = [
  'peticao',
  'decisao',
  'despacho',
  'audiencia',
  'prazo',
  'publicacao',
  'juntada',
  'contato_cliente',
  'observacao',
  'documento',
  'outro',
]

export const ANDAMENTO_ORIGEM_LABELS: Record<AndamentoOrigem, string> = {
  manual: 'Manual',
  tribunal: 'Tribunal',
  publicacao: 'Publicação',
  sistema: 'Sistema',
  aurora: 'Aurora',
}

export const ANDAMENTO_TIPO_LABELS: Record<AndamentoTipo, string> = {
  peticao: 'Petição',
  decisao: 'Decisão',
  despacho: 'Despacho',
  audiencia: 'Audiência',
  prazo: 'Prazo',
  publicacao: 'Publicação',
  juntada: 'Juntada',
  contato_cliente: 'Contato com cliente',
  observacao: 'Observação',
  documento: 'Documento',
  outro: 'Outro',
}

export function normalizeAndamentoTipo(value?: string | null): AndamentoTipo {
  const normalized = (value ?? '').trim().toLowerCase()
  return (ANDAMENTO_TIPOS.includes(normalized as AndamentoTipo) ? normalized : 'outro') as AndamentoTipo
}

export function normalizeAndamentoOrigem(value?: string | null): AndamentoOrigem {
  const normalized = (value ?? '').trim().toLowerCase()
  return (ANDAMENTO_ORIGENS.includes(normalized as AndamentoOrigem) ? normalized : 'manual') as AndamentoOrigem
}

export function andamentoTipoPermitidoParaRole(role: UserRole, tipo: AndamentoTipo) {
  if (role === 'estagiario') return tipo === 'observacao'
  return ['administrativo', 'advogado', 'gerente', 'socio'].includes(role)
}

function formatDateTimeBR(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function buildAndamentosAuroraContext(andamentos: ProcessoAndamento[]) {
  if (!andamentos.length) {
    return [
      'Andamentos do processo:',
      '- Nenhum andamento registrado.',
      'A análise profunda de conteúdo ainda será implementada em fase posterior.',
    ].join('\n')
  }

  const linhas = andamentos.slice(0, 20).map(andamento => {
    const data = formatDateTimeBR(andamento.data_andamento)
    const tipo = ANDAMENTO_TIPO_LABELS[andamento.tipo] ?? andamento.tipo
    const origem = ANDAMENTO_ORIGEM_LABELS[andamento.origem] ?? andamento.origem
    const responsavel = andamento.responsavel?.nome?.trim() || '—'
    const criadoPor = andamento.criado_por_profile?.nome?.trim() || '—'
    const descricao = andamento.descricao?.trim()
    return [
      `- ${data} | ${tipo} | ${andamento.titulo}`,
      `  Origem: ${origem}`,
      `  Responsável: ${responsavel}`,
      `  Criado por: ${criadoPor}`,
      descricao ? `  Descrição: ${descricao}` : null,
    ].filter(Boolean).join('\n')
  })

  return [
    'Andamentos do processo:',
    ...linhas,
    'A análise profunda de conteúdo ainda será implementada em fase posterior.',
  ].join('\n')
}
