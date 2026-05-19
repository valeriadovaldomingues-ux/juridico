import type { FonteMonitoramento } from './types'

export const FONTES_TRTS: FonteMonitoramento[] = Array.from({ length: 24 }, (_, i) => {
  const numero = i + 1
  return {
    id: `trt${numero}`,
    nome: `TRT${numero}`,
    tribunal: `TRT${numero}`,
    ramo: 'trabalhista',
    status: 'pendente',
    descricao: 'Pendente de definição de fonte oficial estável: DEJT, PJe, DataJud ou API específica.',
  }
})
