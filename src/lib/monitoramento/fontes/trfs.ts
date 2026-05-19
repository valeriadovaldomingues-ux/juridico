import type { FonteMonitoramento } from './types'

export const FONTES_TRFS: FonteMonitoramento[] = Array.from({ length: 6 }, (_, i) => {
  const numero = i + 1
  return {
    id: `trf${numero}`,
    nome: `TRF${numero}`,
    tribunal: `TRF${numero}`,
    ramo: 'federal',
    status: 'pendente',
    descricao: 'Pendente de integração por fonte oficial. Onde houver eproc, a execução exigirá análise de acesso público e credenciais.',
  }
})
