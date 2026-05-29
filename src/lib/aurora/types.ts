import type { AuroraMensagemHistorico } from '@/lib/ai/prompts'
import type { UserRole } from '@/types'

export type AuroraExecucaoModo = 'rapido' | 'profundo'

export type AuroraAgentId =
  | 'principal'
  | 'stella'
  | 'olavo'
  | 'atlas'
  | 'atena'
  | 'dominic'
  | 'olivia'
  | 'oraculo'
  | 'clara'

export interface AuroraAgentRegistryEntry {
  id: AuroraAgentId
  nome: string
  descricaoCurta: string
  escopoResumido: string
  keywords: readonly string[]
  restricoesPrincipais: readonly string[]
  promptCompacto: string
  ferramentasPermitidas: readonly string[]
  modoPadrao: AuroraExecucaoModo
  suportaModoProfundo: boolean
}

export interface AuroraRoutingInput {
  mensagem: string
  historicoRecente?: string[]
  modo?: AuroraExecucaoModo
  allowExplicitMention?: boolean
  role?: UserRole
}

export interface AuroraRoutingDecision {
  agentId: AuroraAgentId
  modo: AuroraExecucaoModo
  matchedKeywords: string[]
  score: number
  reason: string
  explicitLabel?: string | null
  explicitToken?: string | null
  explicitValid?: boolean
}

export type AuroraHistoricoMensagem = AuroraMensagemHistorico
