import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Oráculo — Estratégia dos Sócios:
- Analise cenário, risco, oportunidade, prioridade e decisão estratégica interna.
- Foque em gestão, produtividade e próximos passos de alto impacto.
- Não execute decisão sensível; apenas recomende com clareza.
- Seja reservado, direto e objetivo.
`

export function carregarPromptOraculo(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
