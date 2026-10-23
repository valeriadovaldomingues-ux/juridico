// ─── Tipos do provider DJEN — Diário de Justiça Eletrônico Nacional ──────────
//
// Abstração desacoplada de provedor de publicações (spec PublicationProvider).
// O DJEN é canal de PUBLICIDADE processual. Não confundir com o Domicílio
// Judicial Eletrônico (comunicações pessoais, citações e intimações
// direcionadas), que NÃO está integrado — a interface abaixo foi desenhada
// para permitir um futuro DomicilioPublicationProvider sem reescrever o
// módulo de Monitoramento.

export const DJEN_FONTE_CODIGO = 'djen'
export const DJEN_FONTE_NOME = 'DJEN — Diário de Justiça Eletrônico Nacional'

/** Item bruto retornado pela API pública comunicaapi.pje.jus.br. */
export interface ComunicacaoDJENBruta {
  id?: number | string
  hash?: string
  data_disponibilizacao?: string
  datadisponibilizacao?: string
  siglaTribunal?: string
  tipoComunicacao?: string
  nomeOrgao?: string
  texto?: string
  numero_processo?: string
  numeroprocessocommascara?: string
  link?: string
  tipoDocumento?: string
  nomeClasse?: string
  meio?: string
  destinatarios?: Array<{ nome?: string; polo?: string }>
  destinatarioadvogados?: Array<{
    id?: number
    advogado?: { nome?: string; numero_oab?: string; uf_oab?: string }
    nome?: string
    numero_oab?: string
    uf_oab?: string
  }>
}

export interface RespostaDJEN {
  status?: string
  message?: string
  count?: number
  items?: ComunicacaoDJENBruta[]
}

export type TipoConsultaDJEN = 'oab' | 'nome' | 'processo' | 'nome_parte'

/** Uma consulta agrupada à API (1 requisição paginada). */
export interface ConsultaDJEN {
  tipo: TipoConsultaDJEN
  termo: string
  advogado_monitorado_id?: string
  /** Sigla de tribunal para restringir a consulta; ausente = todos. */
  siglaTribunal?: string
  params: Record<string, string>
}

export interface PeriodoConsulta {
  /** ISO yyyy-mm-dd */
  inicio: string
  /** ISO yyyy-mm-dd */
  fim: string
}

export interface ItemEncontradoDJEN {
  consulta: ConsultaDJEN
  item: ComunicacaoDJENBruta
}

export interface ErroConsultaDJEN {
  consulta: string
  mensagem: string
  status_http?: number
  temporario: boolean
}

export interface ResultadoBuscaDJEN {
  encontrados: ItemEncontradoDJEN[]
  consultas_realizadas: number
  paginas_consultadas: number
  total_disponivel: number
  /** true quando alguma consulta parou antes de esgotar as páginas. */
  incompleto: boolean
  erros: ErroConsultaDJEN[]
}

/** Publicação normalizada, pronta para persistência em `publicacoes`. */
export interface PublicacaoDJENNormalizada {
  fonte_codigo: typeof DJEN_FONTE_CODIGO
  id_externo: string | null
  hash: string
  url_oficial: string | null
  tribunal: string | null
  orgao: string | null
  tipo_comunicacao: string | null
  numero_processo: string | null
  numero_processo_digits: string | null
  data_disponibilizacao: string | null
  texto: string
  partes: Array<{ nome: string; polo?: string }> | null
  advogados: Array<{ nome: string; numero_oab?: string; uf_oab?: string }> | null
  nome_pesquisado: string
  termo_encontrado: string
  advogado_monitorado_id: string | null
  dados_brutos: ComunicacaoDJENBruta
}

export type SituacaoProvider =
  | 'operacional'
  | 'rate_limit'
  | 'bloqueado'      // WAF recusa o IP deste ambiente (HTTP 403)
  | 'indisponivel'
  | 'desconhecido'

export interface StatusProvider {
  codigo: string
  situacao: SituacaoProvider
  detalhe: string
  status_http?: number
  verificado_em: string | null
}

/**
 * Contrato de provedor de publicações. Implementações futuras (ex.: Domicílio
 * Judicial Eletrônico) devem seguir esta interface para que o módulo de
 * Monitoramento não precise ser reescrito.
 */
export interface PublicationProvider {
  codigo: string
  nome: string
  searchPublications(
    consultas: ConsultaDJEN[],
    periodo: PeriodoConsulta,
  ): Promise<ResultadoBuscaDJEN>
  fetchPublicationDetails(idExterno: string): Promise<ComunicacaoDJENBruta | null>
  normalizePublication(
    encontrado: ItemEncontradoDJEN,
  ): PublicacaoDJENNormalizada | null
  testConnection(): Promise<StatusProvider>
  getProviderStatus(): StatusProvider
}
