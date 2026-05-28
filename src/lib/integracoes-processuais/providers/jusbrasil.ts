import type {
  IntegracaoProcessualProvider,
  PublicacaoFiltros,
  SincronizacaoProcessoResultado,
} from '../types'

function isConfigured() {
  return Boolean(process.env.JUSBRASIL_API_URL && process.env.JUSBRASIL_API_TOKEN)
}

function notConfigured(): never {
  throw new Error('Provider Jusbrasil nao configurado. Defina JUSBRASIL_API_URL e JUSBRASIL_API_TOKEN somente no servidor.')
}

export const jusbrasilProcessualProvider: IntegracaoProcessualProvider = {
  id: 'jusbrasil',
  nome: 'Jusbrasil',
  descricao: 'Estrutura segura para futura integracao via API oficial/contratada.',
  configurado: isConfigured,
  async buscarProcessoPorNumero() {
    if (!isConfigured()) notConfigured()
    // TODO: implementar chamada server-side usando JUSBRASIL_API_URL/JUSBRASIL_API_TOKEN.
    // Nunca aceitar token pelo body e nunca expor token ao client.
    throw new Error('Provider Jusbrasil ainda nao implementado.')
  },
  async buscarProcessosPorDocumento() {
    if (!isConfigured()) notConfigured()
    throw new Error('Provider Jusbrasil ainda nao implementado.')
  },
  async listarMovimentacoes() {
    if (!isConfigured()) notConfigured()
    throw new Error('Provider Jusbrasil ainda nao implementado.')
  },
  async listarPublicacoes(_filtros: PublicacaoFiltros) {
    if (!isConfigured()) notConfigured()
    throw new Error('Provider Jusbrasil ainda nao implementado.')
  },
  async sincronizarProcesso(): Promise<SincronizacaoProcessoResultado> {
    if (!isConfigured()) notConfigured()
    throw new Error('Provider Jusbrasil ainda nao implementado.')
  },
}
