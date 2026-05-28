import { jusbrasilProcessualProvider } from './providers/jusbrasil'
import { mockProcessualProvider } from './providers/mock'
import type {
  IntegracaoProcessualProvider,
  IntegracaoProcessualProviderId,
  ProviderDisponivel,
} from './types'

const PROVIDERS: Record<IntegracaoProcessualProviderId, IntegracaoProcessualProvider> = {
  mock: mockProcessualProvider,
  jusbrasil: jusbrasilProcessualProvider,
}

export function getProcessualProvider(id: string | null | undefined): IntegracaoProcessualProvider {
  const providerId = id === 'jusbrasil' ? 'jusbrasil' : 'mock'
  return PROVIDERS[providerId]
}

export function listarProvidersProcessuais(): ProviderDisponivel[] {
  return Object.values(PROVIDERS).map(provider => ({
    id: provider.id,
    nome: provider.nome,
    descricao: provider.descricao,
    ativo: provider.id === 'mock',
    configurado: provider.configurado(),
    modo: provider.id === 'mock' ? 'desenvolvimento' : 'externo',
    aceitaCredenciaisNoSistema: false,
  }))
}
