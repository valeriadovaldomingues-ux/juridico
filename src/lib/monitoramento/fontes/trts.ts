import type { FonteMonitoramento } from './types'
import { FONTE_TRT3_MG } from './trt3-mg'

export const FONTES_TRTS: FonteMonitoramento[] = Array.from({ length: 24 }, (_, i) => {
  const numero = i + 1
  if (numero === 3) return FONTE_TRT3_MG

  return {
    id: `trt${numero}`,
    nome: `TRT${numero}`,
    tribunal: `TRT${numero}`,
    ramo: 'trabalhista',
    status: 'pendente',
    descricao: 'Pendente de definição de fonte oficial estável: DEJT, PJe, DataJud ou API específica.',
  }
})
