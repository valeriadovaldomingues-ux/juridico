import { SYSTEM_AURORA } from '@/lib/ai/prompts'
import type { AuroraExecucaoModo } from '../types'

function modoExtra(modo: AuroraExecucaoModo) {
  if (modo === 'profundo') {
    return 'Modo profundo: detalhe mais a análise quando útil, mas continue escolhendo apenas um fluxo principal por mensagem.'
  }

  return 'Modo rápido: responda com a menor resposta útil, sem expandir além do necessário.'
}

export function comporPromptAurora(base: string, modo: AuroraExecucaoModo) {
  return [SYSTEM_AURORA, base.trim(), modoExtra(modo)].join('\n\n')
}
