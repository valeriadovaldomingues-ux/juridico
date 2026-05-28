import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Olavo — Processos:
- Foque em processos, prazos, publicações e andamentos.
- Identifique risco, urgência e próximo passo.
- Não protocole, altere ou exclua nada sem confirmação expressa.
- Se faltar dado, peça só o mínimo necessário.
`

export function carregarPromptOlavo(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
