// ─── Módulo INPI (marcas) ──────────────────────────────────────────────────────
// Acompanhamento de processos de propriedade industrial junto ao INPI,
// separado dos processos judiciais. Ver memória de projeto
// "juridico-modulo-inpi-pendente".

export type InpiTipo = 'marca' | 'patente'

export type InpiStatus =
  | 'em_andamento'
  | 'concedido'
  | 'extinto'
  | 'arquivado'
  | 'indeferido'

export type InpiMovimentacaoOrigem = 'rpi_auto' | 'manual'

export interface InpiProcesso {
  id: string
  cliente_id: string | null
  numero_processo: string
  tipo: InpiTipo
  titulo: string
  natureza: string | null
  classe_nice: string | null
  procurador: string | null
  status: InpiStatus
  data_deposito: string | null
  data_concessao: string | null
  observacoes: string | null
  /** Cliente não vai renovar / não precisa mais ser acompanhado: some dos alertas de decênio e da leitura da RPI. */
  nao_acompanhar: boolean
  /** Prorrogações (decênios) já concedidas: cada uma soma mais 10 anos à vigência. */
  prorrogacoes: number
  nao_acompanhar_motivo: string | null
  nao_acompanhar_em: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  cliente?: { id: string; nome: string; email: string | null; telefone: string | null; celular: string | null } | null
  movimentacoes?: InpiMovimentacao[]
  andamentos?: InpiAndamento[]
}

export type InpiAndamentoTipo = 'peticao' | 'exigencia' | 'taxa' | 'cliente' | 'prorrogacao' | 'observacao' | 'outro'

export const INPI_ANDAMENTO_TIPO_LABEL: Record<InpiAndamentoTipo, string> = {
  peticao:     'Petição protocolada',
  exigencia:   'Exigência / oposição',
  taxa:        'Pagamento de taxa (GRU)',
  cliente:     'Contato com o cliente',
  prorrogacao: 'Prorrogação (decênio)',
  observacao:  'Observação',
  outro:       'Outro',
}

/** O que o advogado fez no processo (diferente da movimentação, que é a publicação da RPI). */
export interface InpiAndamento {
  id: string
  inpi_processo_id: string
  data_andamento: string
  tipo: InpiAndamentoTipo
  titulo: string
  descricao: string | null
  protocolo: string | null
  prorrogacao_deferida: boolean
  responsavel_id: string | null
  responsavel_nome: string | null
  criado_por: string | null
  criado_por_nome: string | null
  created_at: string
}

export interface InpiMovimentacao {
  id: string
  inpi_processo_id: string
  rpi_numero: number | null
  rpi_data: string
  codigo_despacho: string | null
  descricao: string
  origem: InpiMovimentacaoOrigem
  created_by: string | null
  created_at: string
}

export const INPI_STATUS_LABEL: Record<InpiStatus, string> = {
  em_andamento: 'Em andamento',
  concedido:    'Concedido',
  extinto:      'Extinto',
  arquivado:    'Arquivado',
  indeferido:   'Indeferido',
}

export const INPI_TIPO_LABEL: Record<InpiTipo, string> = {
  marca:   'Marca',
  patente: 'Patente',
}

/** Marcas registradas no Brasil têm vigência de 10 anos a partir da
 *  concessão (art. 133, Lei 9.279/96) — o "decênio". A renovação pode ser
 *  pedida no último ano de vigência, ou em até 6 meses depois mediante multa. */
const DECENIO_ANOS = 10

export interface DecenioInfo {
  vencimento: Date
  diasRestantes: number
  /** venceu e já passou da janela de graça de 6 meses com multa */
  expirado: boolean
  /** dentro do último ano de vigência — já pode pedir renovação */
  janelaRenovacao: boolean
  /** venceu mas ainda dá pra renovar pagando multa (até 6 meses depois) */
  janelaMulta: boolean
}

export function calcularDecenio(dataConcessao: string, prorrogacoes = 0, hoje: Date = new Date()): DecenioInfo {
  const concessao = new Date(`${dataConcessao}T12:00:00`)
  const vencimento = new Date(concessao)
  // Vigência: 10 anos da concessão + 10 anos por prorrogação já deferida (igual à tela do INPI).
  vencimento.setFullYear(vencimento.getFullYear() + DECENIO_ANOS * (1 + Math.max(0, prorrogacoes)))

  const limiteMulta = new Date(vencimento)
  limiteMulta.setMonth(limiteMulta.getMonth() + 6)

  const janelaRenovacaoDesde = new Date(vencimento)
  janelaRenovacaoDesde.setFullYear(janelaRenovacaoDesde.getFullYear() - 1)

  const diasRestantes = Math.floor((vencimento.getTime() - hoje.getTime()) / 86_400_000)

  return {
    vencimento,
    diasRestantes,
    expirado: hoje > limiteMulta,
    janelaRenovacao: hoje >= janelaRenovacaoDesde && hoje <= vencimento,
    janelaMulta: hoje > vencimento && hoje <= limiteMulta,
  }
}
