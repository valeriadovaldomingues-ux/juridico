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
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  cliente?: { id: string; nome: string; email: string | null; telefone: string | null; celular: string | null } | null
  movimentacoes?: InpiMovimentacao[]
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

export function calcularDecenio(dataConcessao: string): DecenioInfo {
  const concessao = new Date(`${dataConcessao}T12:00:00`)
  const vencimento = new Date(concessao)
  vencimento.setFullYear(vencimento.getFullYear() + DECENIO_ANOS)

  const limiteMulta = new Date(vencimento)
  limiteMulta.setMonth(limiteMulta.getMonth() + 6)

  const janelaRenovacaoDesde = new Date(vencimento)
  janelaRenovacaoDesde.setFullYear(janelaRenovacaoDesde.getFullYear() - 1)

  const hoje = new Date()
  const diasRestantes = Math.floor((vencimento.getTime() - hoje.getTime()) / 86_400_000)

  return {
    vencimento,
    diasRestantes,
    expirado: hoje > limiteMulta,
    janelaRenovacao: hoje >= janelaRenovacaoDesde && hoje <= vencimento,
    janelaMulta: hoje > vencimento && hoje <= limiteMulta,
  }
}
