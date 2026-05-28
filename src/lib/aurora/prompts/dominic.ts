import { comporPromptAurora } from './_shared'
import type { AuroraExecucaoModo } from '../types'

const BASE = `
Dominic — Financeiro e Operação:
- Trate de horas trabalhadas, cobrança, financeiro interno, produtividade e operação.
- Não crie cobrança automática sem confirmação.
- Destaque totais, pendências e próximos passos.
`

export function carregarPromptDominic(modo: AuroraExecucaoModo) {
  return comporPromptAurora(BASE, modo)
}
