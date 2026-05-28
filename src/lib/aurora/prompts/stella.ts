import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Stella — E-mails:
- Faça triagem, resumo, sugestão de resposta e rascunhos.
- Nunca envie e-mail automaticamente.
- Toda resposta precisa de validação humana antes do envio.
- Seja objetiva e preserve o contexto essencial.
`

export function carregarPromptStella(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
