import { completarJSON } from '@/lib/ai/service'
import { buildAndamentosAuroraContext } from '@/lib/processos/andamentos'
import type { Cliente, Processo, ProcessoAndamento } from '@/types'
import type {
  ComunicacaoInteligenteConteudo,
  ComunicacaoInteligenteConsulta,
  ComunicacaoInteligenteDraft,
} from './types'
import { buildComunicaoTexto, normalizeComunicacaoConteudo } from './validation'

function buildSystemPrompt(tipo: string) {
  return [
    'Você é o módulo Comunicação Inteligente do PEDV.',
    'Sua função é transformar andamentos processuais em linguagem simples para clientes leigos.',
    'Nunca invente fatos, datas, prazos, valores ou resultados.',
    'Nunca faça previsões de resultado.',
    'Se um prazo não estiver expressamente indicado, não o crie.',
    'Diferencie fatos, inferências e pendências.',
    'Responda exclusivamente em JSON válido.',
    `Adapte a extensão da resposta para o tipo "${tipo}".`,
  ].join(' ')
}

function buildUserPayload(processo: Processo, cliente: Cliente, andamentos: ProcessoAndamento[], consulta: ComunicacaoInteligenteConsulta) {
  return {
    tipo: consulta.tipo,
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
    },
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      cpf_cnpj: cliente.cpf_cnpj,
      email: cliente.email,
      telefone: cliente.telefone,
      celular: cliente.celular,
    },
    andamentos: andamentos.map(item => ({
      id: item.id,
      data_andamento: item.data_andamento,
      tipo: item.tipo,
      titulo: item.titulo,
      descricao: item.descricao,
      origem: item.origem,
      responsavel: item.responsavel?.nome ?? null,
      criado_por: item.criado_por_profile?.nome ?? null,
    })),
    contexto_textual: buildAndamentosAuroraContext(andamentos),
    orientacao: 'Produza uma comunicação simples, objetiva e compreensível para o cliente. Faça referência aos fatos do processo sem juridiquês excessivo. Liste o que aconteceu, o significado prático e os próximos passos. A saída deve ser apropriada para revisão humana antes de qualquer envio.',
  }
}

export function buildDefaultTituloComunicacao(processo: Processo) {
  const numero = processo.numero_processo?.trim()
  return numero ? `Atualização do processo ${numero}` : `Atualização do processo ${processo.titulo}`
}

export async function gerarComunicacaoInteligenteDraft(
  processo: Processo,
  cliente: Cliente,
  andamentos: ProcessoAndamento[],
  consulta: ComunicacaoInteligenteConsulta,
): Promise<Pick<ComunicacaoInteligenteDraft,
  | 'tipo'
  | 'canal_destino'
  | 'titulo'
  | 'resumoExecutivo'
  | 'oQueAconteceu'
  | 'oQueIssoSignifica'
  | 'proximosPassos'
  | 'acaoNecessariaCliente'
  | 'mensagemCliente'
  | 'observacoesInternas'
  | 'camposNaoEncontrados'
  | 'inconsistencias'
  | 'conteudo_json'
  | 'conteudo_texto'
>> {
  const raw = await completarJSON([
    { role: 'system', content: buildSystemPrompt(consulta.tipo) },
    { role: 'user', content: JSON.stringify(buildUserPayload(processo, cliente, andamentos, consulta)) },
  ], { temperature: 0.2 })

  const normalized = normalizeComunicacaoConteudo(JSON.parse(raw))
  const conteudo_texto = buildComunicaoTexto(normalized, buildDefaultTituloComunicacao(processo))

  return {
    tipo: consulta.tipo,
    canal_destino: consulta.canalDestino,
    titulo: buildDefaultTituloComunicacao(processo),
    resumoExecutivo: normalized.resumoExecutivo,
    oQueAconteceu: normalized.oQueAconteceu,
    oQueIssoSignifica: normalized.oQueIssoSignifica,
    proximosPassos: normalized.proximosPassos,
    acaoNecessariaCliente: normalized.acaoNecessariaCliente,
    mensagemCliente: normalized.mensagemCliente,
    observacoesInternas: normalized.observacoesInternas,
    camposNaoEncontrados: normalized.camposNaoEncontrados,
    inconsistencias: normalized.inconsistencias,
    conteudo_json: normalized,
    conteudo_texto,
  }
}

export function rebuildComunicacaoTexto(
  conteudo: ComunicacaoInteligenteConteudo,
  titulo?: string,
) {
  return buildComunicaoTexto(conteudo, titulo)
}

type ComunicacaoInteligenteDbRow = {
  id: string
  cliente_id: string
  processo_id: string
  andamento_ids: unknown
  tipo: ComunicacaoInteligenteDraft['tipo']
  canal_destino: ComunicacaoInteligenteDraft['canal_destino']
  status: ComunicacaoInteligenteDraft['status']
  titulo: string
  resumo_executivo?: string | null
  o_que_aconteceu?: string | null
  o_que_isso_significa?: string | null
  proximos_passos?: unknown
  acao_necessaria_cliente?: string | null
  mensagem_cliente?: string | null
  observacoes_internas?: string | null
  campos_nao_encontrados?: unknown
  inconsistencias?: unknown
  conteudo_json?: unknown
  conteudo_texto?: string | null
  visivel_portal: boolean
  aprovado_por: string | null
  aprovado_em: string | null
  enviado_por: string | null
  enviado_em: string | null
  portal_mensagem_id: string | null
  criado_por: string
  atualizado_por: string | null
  created_at: string
  updated_at: string
  criado_por_profile?: ComunicacaoInteligenteDraft['criado_por_profile']
  aprovado_por_profile?: ComunicacaoInteligenteDraft['aprovado_por_profile']
  enviado_por_profile?: ComunicacaoInteligenteDraft['enviado_por_profile']
}

export function mapComunicacaoDbRowToDraft(row: ComunicacaoInteligenteDbRow): ComunicacaoInteligenteDraft {
  const conteudo = normalizeComunicacaoConteudo(row.conteudo_json ?? row)
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    processo_id: row.processo_id,
    andamento_ids: row.andamento_ids,
    tipo: row.tipo,
    canal_destino: row.canal_destino,
    status: row.status,
    titulo: row.titulo,
    resumoExecutivo: row.resumo_executivo ?? conteudo.resumoExecutivo,
    oQueAconteceu: row.o_que_aconteceu ?? conteudo.oQueAconteceu,
    oQueIssoSignifica: row.o_que_isso_significa ?? conteudo.oQueIssoSignifica,
    proximosPassos: Array.isArray(row.proximos_passos)
      ? row.proximos_passos.filter((item): item is string => typeof item === 'string')
      : conteudo.proximosPassos,
    acaoNecessariaCliente: row.acao_necessaria_cliente ?? conteudo.acaoNecessariaCliente,
    mensagemCliente: row.mensagem_cliente ?? conteudo.mensagemCliente,
    observacoesInternas: row.observacoes_internas ?? conteudo.observacoesInternas,
    camposNaoEncontrados: Array.isArray(row.campos_nao_encontrados)
      ? row.campos_nao_encontrados.filter((item): item is string => typeof item === 'string')
      : conteudo.camposNaoEncontrados,
    inconsistencias: Array.isArray(row.inconsistencias)
      ? row.inconsistencias.filter((item): item is string => typeof item === 'string')
      : conteudo.inconsistencias,
    conteudo_json: (row.conteudo_json && typeof row.conteudo_json === 'object' ? row.conteudo_json : conteudo) as ComunicacaoInteligenteConteudo | Record<string, unknown>,
    conteudo_texto: row.conteudo_texto ?? buildComunicaoTexto(conteudo, row.titulo),
    visivel_portal: row.visivel_portal,
    aprovado_por: row.aprovado_por,
    aprovado_em: row.aprovado_em,
    enviado_por: row.enviado_por,
    enviado_em: row.enviado_em,
    portal_mensagem_id: row.portal_mensagem_id,
    criado_por: row.criado_por,
    atualizado_por: row.atualizado_por,
    created_at: row.created_at,
    updated_at: row.updated_at,
    criado_por_profile: row.criado_por_profile ?? null,
    aprovado_por_profile: row.aprovado_por_profile ?? null,
    enviado_por_profile: row.enviado_por_profile ?? null,
  }
}
