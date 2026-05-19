import type { FonteMonitoramento } from './types'

const TJS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ',
  'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
]

export const FONTES_TJS: FonteMonitoramento[] = TJS.map(tribunal => ({
  id: tribunal.toLowerCase(),
  nome: tribunal,
  tribunal,
  ramo: 'estadual',
  status: 'pendente',
  descricao: 'Pendente de integração por diário oficial, DataJud ou API oficial do tribunal.',
}))
