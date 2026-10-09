// ─── Publicação vira andamento ───────────────────────────────────────────────
//
// Uma publicação capturada no DJEN é um fato: aconteceu, está no diário, e o
// registro dela não muda mais. Este módulo grava esse fato na linha do tempo
// do processo — um ANDAMENTO — a partir de uma publicação recém-inserida.
//
// Nada aqui pode derrubar a inserção da publicação. Se a derivação falhar, a
// publicação continua gravada — ela é o registro que importa juridicamente.
// Por isso a função devolve o que deu errado em vez de lançar exceção.

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

/**
 * Deriva o andamento de uma publicação recém-gravada.
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

  return { andamento, erros }
}
