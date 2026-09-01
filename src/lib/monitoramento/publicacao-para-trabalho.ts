// ─── Publicação vira trabalho ────────────────────────────────────────────────
//
// Uma publicação capturada no DJEN é um fato: aconteceu, está no diário, e o
// registro dela não muda mais. Trabalho é outra coisa — alguém precisa ler,
// decidir e agir. Este módulo faz a ponte entre os dois, gerando a partir de
// uma publicação recém-inserida:
//
//   1. um ANDAMENTO no processo  → a linha do tempo, que fica para sempre
//   2. uma TAREFA no Kanban      → o trabalho, que alguém conclui e arquiva
//
// Por que os dois, e não só a tarefa: quando a tarefa for concluída e
// arquivada, o andamento continua lá. É ele que prova, meses depois, que o
// escritório foi intimado naquela data.
//
// Nada aqui pode derrubar a inserção da publicação. Se a derivação falhar, a
// publicação continua gravada — ela é o registro que importa juridicamente, e a
// tarefa pode ser recriada depois. Por isso toda função devolve o que deu
// errado em vez de lançar exceção.

import { calculateSimpleSLA } from '@/lib/kanban-sla'
import type { KanbanPrioridade } from '@/types/kanban'

/**
 * Client mínimo de que este módulo precisa: inserir numa tabela.
 *
 * Tipado de forma estrutural em vez de `any` para o compilador cobrar a forma
 * da resposta. Aceita o client SSR, o de service role e os fakes de teste.
 */
type RespostaInsercao = { error: { message?: string } | null }

export type DbClient = {
  from: (tabela: string) => {
    insert: (payload: Record<string, unknown>) => PromiseLike<RespostaInsercao>
  }
}

/**
 * Perfil que assina o que a automação cria. Ver publicacao_para_kanban_migration.sql.
 *
 * Lido a cada chamada, não no carregamento do módulo: em serverless o módulo
 * fica em cache entre invocações, e uma variável de ambiente alterada depois do
 * primeiro import nunca seria vista.
 */
function roboProfileId(): string | null {
  return process.env.ROBO_PROFILE_ID?.trim() || null
}

export interface DadosPublicacao {
  numero_processo: string | null
  processo_id: string | null
  tribunal: string | null
  orgao: string | null
  data_disponibilizacao: string | null
  tipo_comunicacao: string | null
  tipo_publicacao: string | null
  texto: string
  url_oficial: string | null
  partes: unknown
  prazo_detectado: boolean
  prazo_data: string | null
  prazo_dias: number | null
  prazo_descricao: string | null
  audiencia_detectada: boolean
  audiencia_data: string | null
}

export interface ResultadoDerivacao {
  andamento: 'criado' | 'sem_processo' | 'sem_robo' | 'falha'
  tarefa: 'criada' | 'duplicada' | 'falha'
  erros: string[]
}

// ─── Apresentação ────────────────────────────────────────────────────────────

/** 'AUTOR X RÉU' — é assim que alguém reconhece o caso sem abrir nada. */
export function resumirPartes(partes: unknown, limite = 2): string | null {
  if (!Array.isArray(partes) || partes.length === 0) return null

  // O campo vem do banco como jsonb, então chega sem garantia de forma.
  const registros = partes as Array<{ polo?: unknown; nome?: unknown }>

  const lado = (polo: string) =>
    registros
      .filter(p => String(p?.polo ?? '').toUpperCase() === polo)
      .map(p => String(p?.nome ?? '').trim())
      .filter(Boolean)

  const nomear = (nomes: string[]) =>
    nomes.length === 0
      ? ''
      : nomes.slice(0, limite).join(', ') + (nomes.length > limite ? ' E OUTROS' : '')

  const ativo = nomear(lado('A'))
  const passivo = nomear(lado('P'))

  if (ativo && passivo) return `${ativo} X ${passivo}`
  return ativo || passivo || null
}

function dataCurta(iso: string | null): string {
  if (!iso) return ''
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}` : ''
}

/** Órgãos têm nomes quilométricos ("…Camaragibe - Turno Manhã - 07:00h às 13:00h"). */
function encurtar(texto: string | null, max: number): string {
  const limpo = (texto ?? '').trim()
  return limpo.length > max ? `${limpo.slice(0, max - 1).trimEnd()}…` : limpo
}

export function montarTitulo(pub: DadosPublicacao): string {
  const campos = [
    pub.numero_processo,
    pub.data_disponibilizacao ? `PUBLICAÇÃO DJEN ${dataCurta(pub.data_disponibilizacao)}` : null,
    pub.tribunal,
    resumirPartes(pub.partes),
    (pub.tipo_comunicacao || pub.tipo_publicacao || '').toUpperCase() || null,
    encurtar(pub.orgao, 60) || null,
  ].filter(Boolean)

  return campos.join(' - ').slice(0, 500) || 'Publicação sem identificação'
}

export function montarDescricao(pub: DadosPublicacao): string {
  const linhas = [
    pub.numero_processo ? `**Processo:** ${pub.numero_processo}` : null,
    pub.data_disponibilizacao ? `**Disponibilizado em:** ${pub.data_disponibilizacao}` : null,
    `**Tribunal / Órgão:** ${[pub.tribunal, pub.orgao].filter(Boolean).join(' — ') || '—'}`,
    pub.tipo_comunicacao ? `**Tipo:** ${pub.tipo_comunicacao}` : null,
    resumirPartes(pub.partes, 6) ? `**Partes:** ${resumirPartes(pub.partes, 6)}` : null,
    '',
    pub.prazo_detectado
      ? `**Prazo detectado:** ${pub.prazo_descricao ?? `${pub.prazo_dias ?? '?'} dia(s)`}` +
        (pub.prazo_data ? ` — vence em ${pub.prazo_data}` : '')
      : '**Prazo:** não identificado automaticamente no texto',
    pub.audiencia_detectada && pub.audiencia_data
      ? `**Audiência detectada:** ${pub.audiencia_data}`
      : null,
    '',
    pub.url_oficial ? `**Ler a publicação:** ${pub.url_oficial}` : null,
    '',
    '_Criado automaticamente a partir do monitoramento do DJEN._',
    '_A detecção de prazo é uma leitura automática do texto — confira antes de contar._',
  ].filter(l => l !== null)

  return linhas.join('\n')
}

/** Prazo curto merece mais destaque na fila. */
export function derivarPrioridade(pub: DadosPublicacao): KanbanPrioridade {
  if (!pub.prazo_detectado) return 'media'
  if (pub.prazo_dias !== null && pub.prazo_dias <= 5) return 'urgente'
  if (pub.prazo_dias !== null && pub.prazo_dias <= 10) return 'alta'
  return 'media'
}

// ─── Gravação ────────────────────────────────────────────────────────────────

async function criarAndamento(
  supabase: DbClient,
  publicacaoId: string,
  pub: DadosPublicacao,
): Promise<ResultadoDerivacao['andamento']> {
  // Sem processo vinculado não há linha do tempo onde pendurar o andamento.
  // Acontece quando o número não bate com nenhum processo cadastrado, ou bate
  // com vários (persistencia.ts não vincula em caso de ambiguidade).
  if (!pub.processo_id) return 'sem_processo'
  const robo = roboProfileId()
  if (!robo) return 'sem_robo'

  const { error } = await supabase.from('processo_andamentos').insert({
    processo_id: pub.processo_id,
    data_andamento: pub.data_disponibilizacao
      ? `${pub.data_disponibilizacao}T12:00:00Z`
      : new Date().toISOString(),
    tipo: 'publicacao',
    origem: 'publicacao',
    titulo: montarTitulo(pub).slice(0, 300),
    descricao: montarDescricao(pub),
    criado_por: robo,
  })

  return error ? 'falha' : 'criado'
}

async function criarTarefa(
  supabase: DbClient,
  publicacaoId: string,
  pub: DadosPublicacao,
): Promise<{ estado: ResultadoDerivacao['tarefa']; erro?: string }> {
  const data = pub.prazo_data ?? null
  const sla = calculateSimpleSLA({ data, status: 'a_fazer' })

  const { error } = await supabase.from('kanban_tasks').insert({
    titulo: montarTitulo(pub).slice(0, 300),
    descricao: montarDescricao(pub),
    tipo: pub.prazo_detectado ? 'prazo' : 'tarefa',
    status: 'a_fazer',
    prioridade: derivarPrioridade(pub),
    numero_processo: pub.numero_processo,
    partes_resumidas: resumirPartes(pub.partes),
    processo_id: pub.processo_id,
    publicacao_id: publicacaoId,
    origem: 'publicacao',
    data,
    ordem: 0,
    sla_level: sla.sla_level,
    sla_due_at: sla.sla_due_at,
  })

  if (!error) return { estado: 'criada' }

  // O índice único em publicacao_id transforma corrida entre execuções em
  // conflito de chave — que é "já existe", não erro.
  const mensagem = String(error?.message ?? '')
  if (/duplicate key|unique/i.test(mensagem)) return { estado: 'duplicada' }

  return { estado: 'falha', erro: mensagem }
}

/**
 * Deriva andamento e tarefa de uma publicação recém-gravada.
 *
 * Nunca lança: quem chama não pode perder a publicação por causa daqui.
 */
export async function derivarTrabalhoDaPublicacao(
  supabase: DbClient,
  publicacaoId: string,
  pub: DadosPublicacao,
): Promise<ResultadoDerivacao> {
  const erros: string[] = []

  let andamento: ResultadoDerivacao['andamento'] = 'falha'
  try {
    andamento = await criarAndamento(supabase, publicacaoId, pub)
    if (andamento === 'falha') erros.push('andamento não pôde ser criado')
  } catch (e) {
    erros.push(`andamento: ${e instanceof Error ? e.message : String(e)}`)
  }

  let tarefa: ResultadoDerivacao['tarefa'] = 'falha'
  try {
    const r = await criarTarefa(supabase, publicacaoId, pub)
    tarefa = r.estado
    if (r.erro) erros.push(`tarefa: ${r.erro}`)
  } catch (e) {
    erros.push(`tarefa: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { andamento, tarefa, erros }
}
