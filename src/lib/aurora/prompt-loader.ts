import type { AuroraAgentId, AuroraExecucaoModo } from './types'
import type { UserRole } from '@/types'
import { exigirAuroraSocio } from './security'

export async function carregarPromptCompletoAurora(
  agentId: AuroraAgentId,
  modo: AuroraExecucaoModo = 'rapido',
  role?: UserRole | null,
) {
  exigirAuroraSocio(role)
  switch (agentId) {
    case 'principal':
      return (await import('./prompts/principal')).carregarPromptPrincipal(modo)
    case 'olavo':
      return (await import('./prompts/olavo')).carregarPromptOlavo(modo)
    case 'stella':
      return (await import('./prompts/stella')).carregarPromptStella(modo)
    case 'atena':
      return (await import('./prompts/atena')).carregarPromptAtena(modo)
    case 'olivia':
      return (await import('./prompts/olivia')).carregarPromptOlivia(modo)
    case 'oraculo':
      return (await import('./prompts/oraculo')).carregarPromptOraculo(modo)
    case 'atlas':
      return (await import('./prompts/atlas')).carregarPromptAtlas(modo)
    case 'dominic':
      return (await import('./prompts/dominic')).carregarPromptDominic(modo)
    default:
      return (await import('./prompts/principal')).carregarPromptPrincipal(modo)
  }
}
