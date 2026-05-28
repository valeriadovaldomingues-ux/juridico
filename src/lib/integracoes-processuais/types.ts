export type IntegracaoProcessualProviderId = 'mock' | 'jusbrasil'

export type IntegracaoProcessualOperacao =
  | 'buscar_processo'
  | 'buscar_processos_documento'
  | 'listar_movimentacoes'
  | 'listar_publicacoes'
  | 'sincronizar_processo'

export type IntegracaoProcessualStatus = 'sucesso' | 'erro'

export interface ProcessoNormalizado {
  numeroCnj: string
  classe?: string
  tribunal?: string
  grau?: string
  area?: string
  assunto?: string
  status?: string
  partes: Array<{
    nome: string
    tipo?: string
    documento?: string
  }>
  urlOrigem?: string
  origem: IntegracaoProcessualProviderId | string
  atualizadoEm: string
}

export interface MovimentacaoNormalizada {
  id: string
  numeroCnj: string
  data: string
  titulo: string
  descricao?: string
  origem: IntegracaoProcessualProviderId | string
  urlOrigem?: string
}

export interface PublicacaoNormalizada {
  id: string
  numeroCnj?: string
  dataPublicacao: string
  tribunal?: string
  diario?: string
  texto: string
  origem: IntegracaoProcessualProviderId | string
  urlOrigem?: string
}

export interface PublicacaoFiltros {
  numeroCnj?: string
  termo?: string
  dataInicio?: string
  dataFim?: string
}

export interface SincronizacaoProcessoResultado {
  processo: ProcessoNormalizado | null
  movimentacoes: MovimentacaoNormalizada[]
  publicacoes: PublicacaoNormalizada[]
  provider: IntegracaoProcessualProviderId | string
  sincronizadoEm: string
}

export interface ProviderDisponivel {
  id: IntegracaoProcessualProviderId
  nome: string
  descricao: string
  ativo: boolean
  configurado: boolean
  modo: 'desenvolvimento' | 'externo'
  aceitaCredenciaisNoSistema: false
}

export interface IntegracaoProcessualProvider {
  id: IntegracaoProcessualProviderId
  nome: string
  descricao: string
  configurado(): boolean
  buscarProcessoPorNumero(numeroCnj: string): Promise<ProcessoNormalizado | null>
  buscarProcessosPorDocumento(cpfCnpj: string): Promise<ProcessoNormalizado[]>
  listarMovimentacoes(numeroCnj: string): Promise<MovimentacaoNormalizada[]>
  listarPublicacoes(filtros: PublicacaoFiltros): Promise<PublicacaoNormalizada[]>
  sincronizarProcesso(numeroCnj: string): Promise<SincronizacaoProcessoResultado>
}
