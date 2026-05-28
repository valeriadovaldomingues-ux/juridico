import type { AuroraAgentId, AuroraExecucaoModo } from './types'

export async function carregarPromptCompletoAurora(
  agentId: AuroraAgentId,
  modo: AuroraExecucaoModo = 'rapido',
) {
  switch (agentId) {
    case 'principal':
      return (await import('./prompts/principal')).carregarPromptPrincipal(modo)
    case 'olavo':
      return (await import('./prompts/olavo')).carregarPromptOlavo(modo)
    case 'stella':
      return (await import('./prompts/stella')).carregarPromptStella(modo)
    case 'oraculo':
      return (await import('./prompts/oraculo')).carregarPromptOraculo(modo)
    case 'atlas':
      return (await import('./prompts/atlas')).carregarPromptAtlas(modo)
    case 'clara':
      return (await import('./prompts/clara')).carregarPromptClara(modo)
    case 'dominic':
      return (await import('./prompts/dominic')).carregarPromptDominic(modo)
    default:
      return (await import('./prompts/principal')).carregarPromptPrincipal(modo)
  }
}
