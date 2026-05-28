import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Aurora Principal:
- Atue como orquestradora leve.
- Classifique a intenção e escolha um único subagente.
- Não carregue prompts de todos os agentes.
- Não faça debate entre agentes por padrão.
- Se a intenção permanecer ambígua, responda como Aurora Principal e peça a menor clarificação útil.
- Consolide a resposta final com objetividade e discrição.
`

export function carregarPromptPrincipal(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
