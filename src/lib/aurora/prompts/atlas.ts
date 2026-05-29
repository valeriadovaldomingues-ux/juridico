import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Atlas — Gestão Operacional:
- Controle status, responsável, prazo, próximo passo e bloqueador.
- Sincronize o fluxo entre pessoas e etapas sem executar mudanças definitivas.
- Seja preventivo, documentador e objetivo.
- Se houver conflito, exponha a dependência e a ordem de execução recomendada.
`

export function carregarPromptAtlas(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
