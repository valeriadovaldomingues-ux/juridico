import { completarJSON } from '@/lib/ai/service'
import type { Cliente, Processo, ProcessoAndamento } from '@/types'
import { ANDAMENTO_ORIGEM_LABELS, ANDAMENTO_TIPO_LABELS } from '@/lib/processos/andamentos'
import type { RelatorioClienteDraft, RelatorioConsulta } from './types'
import { buildRelatorioPeriodoLabel, buildRelatorioTexto, normalizeRelatorioConteudo } from './validation'

function formatDateTimeBR(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function buildAndamentosContext(andamentos: ProcessoAndamento[]) {
  if (!andamentos.length) {
    return [
      'Andamentos do processo:',
      '- Nenhuma movimentação encontrada no período selecionado.',
    ].join('\n')
  }

  return [
    'Andamentos do processo:',
    ...andamentos.slice(0, 40).map(andamento => {
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
    }),
  ].join('\n')
}

function buildSystemPrompt() {
  return [
    'Você é Aurora Relatórios, especialista em comunicação jurídica para clientes.',
    'Sua função é transformar andamentos processuais em relatórios claros para pessoas sem formação jurídica.',
    'Regras:',
    '- Nunca invente fatos.',
    '- Nunca invente prazos.',
    '- Nunca prometa resultados.',
    '- Nunca faça previsão de êxito.',
    '- Utilize apenas os dados fornecidos.',
    '- Traduza juridiquês para linguagem simples.',
    '- Seja objetiva e profissional.',
    'Retorne APENAS JSON válido com as chaves:',
    'resumoExecutivo, principaisMovimentacoes, situacaoAtual, oQueIssoSignifica, proximosPassos, providenciasCliente.',
    'Se não existir providência para o cliente, preencha providenciasCliente com: Nenhuma providência é necessária neste momento.',
  ].join(' ')
}

function buildUserPayload(
  processo: Processo & { cliente: Cliente },
  andamentos: ProcessoAndamento[],
  consulta: RelatorioConsulta,
) {
  return {
    periodo: {
      inicio: consulta.periodoInicio ?? null,
      fim: consulta.periodoFim ?? null,
      descricao: buildRelatorioPeriodoLabel(consulta.periodoInicio, consulta.periodoFim),
    },
    processo: {
      id: processo.id,
      numero_processo: processo.numero_processo,
      titulo: processo.titulo,
      area_direito: processo.area_direito,
      status: processo.status,
      fase: processo.fase,
      tribunal: processo.tribunal,
      comarca: processo.comarca ?? null,
      vara: processo.vara,
      classe_processual: processo.classe_processual ?? null,
      assunto: processo.assunto ?? null,
      segredo_justica: processo.segredo_justica ?? null,
      valor_causa: processo.valor_causa ?? null,
      data_distribuicao: processo.data_distribuicao ?? null,
    },
    cliente: {
      id: processo.cliente.id,
      nome: processo.cliente.nome,
      cpf_cnpj: processo.cliente.cpf_cnpj,
      email: processo.cliente.email,
      telefone: processo.cliente.telefone,
      celular: processo.cliente.celular,
      endereco: processo.cliente.endereco,
      tipo_pessoa: processo.cliente.tipo_pessoa,
    },
    andamentos: andamentos.map(andamento => ({
      id: andamento.id,
      data_andamento: andamento.data_andamento,
      tipo: andamento.tipo,
      titulo: andamento.titulo,
      descricao: andamento.descricao,
      origem: andamento.origem,
      responsavel: andamento.responsavel?.nome ?? null,
      criado_por: andamento.criado_por_profile?.nome ?? null,
    })),
    contexto_textual: buildAndamentosContext(andamentos),
  }
}

export function buildRelatorioTitulo(processo: Processo, consulta: RelatorioConsulta) {
  const periodo = buildRelatorioPeriodoLabel(consulta.periodoInicio, consulta.periodoFim)
  return `Relatório do processo ${processo.numero_processo ?? processo.titulo} — ${periodo}`
}

export async function gerarRelatorioInteligenteDraft(
  processo: Processo & { cliente: Cliente },
  andamentos: ProcessoAndamento[],
  consulta: RelatorioConsulta,
): Promise<Pick<RelatorioClienteDraft,
  | 'titulo'
  | 'resumo_executivo'
  | 'conteudo'
  | 'conteudo_texto'
  | 'status'
>> {
  const raw = await completarJSON([
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: JSON.stringify(buildUserPayload(processo, andamentos, consulta)) },
  ], { temperature: 0.2 })

  const conteudo = normalizeRelatorioConteudo(JSON.parse(raw))
  return {
    titulo: buildRelatorioTitulo(processo, consulta),
    resumo_executivo: conteudo.resumoExecutivo,
    conteudo,
    conteudo_texto: buildRelatorioTexto(conteudo, buildRelatorioTitulo(processo, consulta)),
    status: 'rascunho',
  }
}

type RelatorioDbRow = {
  id: string
  cliente_id: string
  processo_id: string
  titulo: string
  periodo_inicio: string | null
  periodo_fim: string | null
  resumo_executivo: string | null
  conteudo: unknown
  conteudo_texto: string | null
  status: RelatorioClienteDraft['status']
  gerado_por: string
  aprovado_por: string | null
  publicado_por: string | null
  created_at: string
  approved_at: string | null
  published_at: string | null
  updated_at: string
  gerado_por_profile?: RelatorioClienteDraft['gerado_por_profile']
  aprovado_por_profile?: RelatorioClienteDraft['aprovado_por_profile']
  publicado_por_profile?: RelatorioClienteDraft['publicado_por_profile']
}

export function mapRelatorioDbRowToDraft(row: RelatorioDbRow): RelatorioClienteDraft {
  const conteudo = normalizeRelatorioConteudo(row.conteudo ?? row)
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    processo_id: row.processo_id,
    titulo: row.titulo,
    periodo_inicio: row.periodo_inicio,
    periodo_fim: row.periodo_fim,
    resumo_executivo: row.resumo_executivo ?? conteudo.resumoExecutivo,
    resumoExecutivo: conteudo.resumoExecutivo,
    principaisMovimentacoes: conteudo.principaisMovimentacoes,
    situacaoAtual: conteudo.situacaoAtual,
    oQueIssoSignifica: conteudo.oQueIssoSignifica,
    proximosPassos: conteudo.proximosPassos,
    providenciasCliente: conteudo.providenciasCliente,
    conteudo,
    conteudo_texto: row.conteudo_texto ?? buildRelatorioTexto(conteudo, row.titulo),
    status: row.status,
    gerado_por: row.gerado_por,
    aprovado_por: row.aprovado_por,
    publicado_por: row.publicado_por,
    created_at: row.created_at,
    approved_at: row.approved_at,
    published_at: row.published_at,
    updated_at: row.updated_at,
    gerado_por_profile: row.gerado_por_profile ?? null,
    aprovado_por_profile: row.aprovado_por_profile ?? null,
    publicado_por_profile: row.publicado_por_profile ?? null,
  }
}

export function buildRelatorioPdfSubtitle(relatorio: RelatorioClienteDraft) {
  return buildRelatorioPeriodoLabel(relatorio.periodo_inicio, relatorio.periodo_fim)
}
