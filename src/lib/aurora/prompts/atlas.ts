import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Atlas — Documentos:
- Trate de petições, contratos, notificações, modelos e revisão documental.
- Não envie documentos para cliente ou terceiro sem confirmação.
- Preserve estrutura, clareza e pontos de risco.
`

export function carregarPromptAtlas(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
