export type CobrancaStatus =
  | 'rascunho'
  | 'pendente'
  | 'processando'
  | 'emitida'
  | 'erro_emissao'
  | 'vencida'
  | 'paga'
  | 'cancelada'

export interface Cobranca {
  id: string
  cliente_id: string
  contrato_id: string | null
  processo_id: string | null
  valor: number
  data_vencimento: string
  descricao: string
  parcela_numero: number
  parcela_total: number
  status: CobrancaStatus
  inter_status: string | null
  inter_cobranca_id: string | null
  nosso_numero: string | null
  linha_digitavel: string | null
  codigo_barras: string | null
  pix_qrcode: string | null
  pix_copia_cola: string | null
  boleto_pdf_url: string | null
  data_pagamento: string | null
  valor_pago: number | null
  payload_criacao: unknown | null
  payload_ultimo_status: unknown | null
  erro_emissao: string | null
  idempotency_key: string
  created_by: string | null
  created_at: string
  updated_at: string
  cliente?: { id: string; nome: string; cpf_cnpj?: string | null; email?: string | null } | null
  processo?: { id: string; numero_processo: string | null; titulo: string | null } | null
}

export type CobrancaInsertRow = Omit<Cobranca, 'id' | 'created_at' | 'updated_at' | 'cliente' | 'processo'>
export type CobrancaUpdateRow = Partial<CobrancaInsertRow>

export interface CobrancaDuplicateKey {
  cliente_id: string
  processo_id: string | null
  valor: number
  data_vencimento: string
  parcela_numero: number
  parcela_total: number
}

export interface CobrancaInput {
  cliente_id: string
  processo_id?: string | null
  contrato_id?: string | null
  valor: number
  data_vencimento: string
  descricao: string
  parcela_numero?: number
  parcela_total?: number
}
