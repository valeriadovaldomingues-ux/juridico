import type { FonteMonitoramento } from './types'

export const TRIBUNAIS_POTENCIAIS_ESAJ = [
  'TJSP',
  'TJMS',
  'TJSC',
  'TJAC',
  'TJAL',
  'TJAM',
  'TJCE',
  'TJBA',
  'TJPE',
] as const

export const FONTE_ESAJ: FonteMonitoramento = {
  id: 'esaj',
  nome: 'e-SAJ',
  tribunal: 'Múltiplos TJs',
  ramo: 'estadual',
  status: 'pendente',
  descricao: `Fonte para tribunais que utilizam ou já utilizaram e-SAJ. Requer implementação específica por tribunal e validação de acesso público. Potenciais TJs para investigação: ${TRIBUNAIS_POTENCIAIS_ESAJ.join(', ')}.`,
}
