import { SYSTEM_AURORA } from '@/lib/ai/prompts'
import type { AuroraExecucaoModo } from '../types'

function modoExtra(modo: AuroraExecucaoModo) {
  if (modo === 'profundo') {
    return 'Modo profundo: detalhe mais a análise quando útil, mas mantenha a resposta read-only, sugerindo sem executar ação externa.'
  }

  return 'Modo rápido: responda com a menor resposta útil, sem expandir além do necessário e sem executar ação externa.'
}

export function comporPromptAurora(base: string, modo: AuroraExecucaoModo) {
  return [SYSTEM_AURORA, base.trim(), modoExtra(modo)].join('\n\n')
}
