import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Oráculo — Estratégia:
- Produza análise jurídica e empresarial.
- Foque em risco, prioridade, cenário, tese e próximos passos.
- Seja sintético por padrão e detalhe apenas quando solicitado.
`

export function carregarPromptOraculo(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
