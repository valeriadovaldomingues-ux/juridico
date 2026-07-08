// Consulta inteligente DETERMINÍSTICA (item 8) — sem IA.
// Interpreta perguntas como "quais clientes estão devendo?" / "quem está em dia?"
// e devolve o filtro de status correspondente sobre o mês vigente.

import type { HonorarioMensal, HonorarioStatus } from './types'

export type IntencaoConsulta = 'devendo' | 'em_dia' | 'parcial' | 'em_atraso' | 'isento' | 'todos'

export interface ResultadoConsulta {
  intencao: IntencaoConsulta
  titulo: string
  statusFiltro: HonorarioStatus[]
  registros: HonorarioMensal[]
}

// Combining diacritical marks U+0300–U+036F (via RegExp p/ evitar corrupção de literais).
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()
}

/** Detecta a intenção a partir de palavras-chave. Ordem = prioridade. */
export function detectarIntencao(pergunta: string): IntencaoConsulta {
  const t = normalizar(pergunta)

  if (/(em atraso|atrasad|inadimplent|vencid)/.test(t)) return 'em_atraso'
  if (/(parcia)/.test(t)) return 'parcial'
  if (/(isent)/.test(t)) return 'isento'
  if (/(em dia|quit|pagaram|pagou|pago|adimplent)/.test(t)) return 'em_dia'
  if (/(devend|deve|devedor|pendent|inadimpl|nao pagar|nao pagou|em aberto)/.test(t)) return 'devendo'
  return 'todos'
}

const FILTRO_POR_INTENCAO: Record<IntencaoConsulta, HonorarioStatus[]> = {
  devendo:   ['pendente', 'parcial', 'em_atraso'],
  em_dia:    ['pago'],
  parcial:   ['parcial'],
  em_atraso: ['em_atraso'],
  isento:    ['isento'],
  todos:     ['pago', 'pendente', 'parcial', 'em_atraso', 'isento'],
}

const TITULO_POR_INTENCAO: Record<IntencaoConsulta, string> = {
  devendo:   'Clientes com pagamento em aberto',
  em_dia:    'Clientes em dia',
  parcial:   'Clientes com pagamento parcial',
  em_atraso: 'Clientes em atraso',
  isento:    'Clientes isentos',
  todos:     'Todos os clientes do mês',
}

export function executarConsulta(pergunta: string, registros: HonorarioMensal[]): ResultadoConsulta {
  const intencao = detectarIntencao(pergunta)
  const statusFiltro = FILTRO_POR_INTENCAO[intencao]
  return {
    intencao,
    titulo: TITULO_POR_INTENCAO[intencao],
    statusFiltro,
    registros: registros.filter(r => statusFiltro.includes(r.status)),
  }
}
