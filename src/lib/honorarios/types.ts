// Tipos do módulo Financeiro > Controle de Honorários.

export type HonorarioStatus = 'pago' | 'pendente' | 'parcial' | 'em_atraso' | 'isento'
export type ContratoStatus = 'ativo' | 'suspenso' | 'encerrado'
export type TipoHonorario = 'recorrente' | 'extra'
export type ExtraStatus = 'ativo' | 'cancelado'
export type HonorarioLogAcao = 'criado' | 'editado' | 'pago' | 'cancelado' | 'arquivado' | 'fechamento'

export const HONORARIO_STATUS: HonorarioStatus[] = [
  'pago', 'pendente', 'parcial', 'em_atraso', 'isento',
]

export const HONORARIO_STATUS_LABELS: Record<HonorarioStatus, string> = {
  pago:      'Pago',
  pendente:  'Pendente',
  parcial:   'Parcial',
  em_atraso: 'Em atraso',
  isento:    'Isento',
}

export const FORMAS_PAGAMENTO = ['pix', 'boleto', 'transferencia', 'dinheiro', 'cartao', 'outro'] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix:           'PIX',
  boleto:        'Boleto',
  transferencia: 'Transferência',
  dinheiro:      'Dinheiro',
  cartao:        'Cartão',
  outro:         'Outro',
}

export interface ClienteResumo {
  id: string
  nome: string
}

export interface HonorarioContrato {
  id: string
  cliente_id: string
  valor_mensal: number
  dia_vencimento: number
  isento: boolean
  status: ContratoStatus
  data_inicio: string
  data_fim: string | null
  observacoes: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
  cliente?: ClienteResumo | null
}

export interface HonorarioMensal {
  id: string
  competencia: string            // 'YYYY-MM-01'
  cliente_id: string
  contrato_id: string | null
  valor_devido: number
  saldo_anterior: number
  valor_pago: number
  saldo_pendente: number         // coluna gerada (valor_devido + saldo_anterior - valor_pago)
  vencimento: string | null
  status: HonorarioStatus
  data_pagamento: string | null
  forma_pagamento: string | null
  observacoes: string | null
  responsavel_lancamento_id: string | null
  tipo: TipoHonorario
  extra_id: string | null
  parcela_num: number | null
  parcela_total: number | null
  cancelado: boolean
  cancelado_em: string | null
  cancelado_por: string | null
  arquivado: boolean
  criado_por: string | null
  created_at: string
  updated_at: string
  cliente?: ClienteResumo | null
  responsavel?: { id: string; nome: string } | null
}

export interface HonorarioExtra {
  id: string
  cliente_id: string
  descricao: string
  valor_total: number
  num_parcelas: number
  forma_pagamento: string | null
  primeira_competencia: string
  status: ExtraStatus
  observacoes: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
  cliente?: ClienteResumo | null
}

export interface HonorarioDashboard {
  previsto: number
  recebido: number
  pendente: number
  emAtraso: number          // valor em atraso
  adimplenciaPct: number    // 0–100
  clientesInadimplentes: number
  cobraveis: number
}

export interface HonorarioTotais {
  previsto: number
  recebido: number
  pendente: number
  emDia: number
  pendentes: number
  parciais: number
  emAtraso: number
  isentos: number
  totalRegistros: number
}

// Linha a ser inserida em honorarios_mensais (sem colunas geradas/servidor).
export interface NovoRegistroMensal {
  competencia: string
  cliente_id: string
  contrato_id: string | null
  valor_devido: number
  saldo_anterior: number
  vencimento: string | null
  status: HonorarioStatus
  tipo: TipoHonorario
  extra_id?: string | null
  parcela_num?: number | null
  parcela_total?: number | null
}
