// Exportação Excel (.xlsx) determinística dos honorários (item 7).
// Usa o pacote `xlsx` (já instalado) apenas para ESCRITA dos nossos dados.

import * as XLSX from 'xlsx'
import { formatCompetencia } from './service'
import { HONORARIO_STATUS_LABELS } from './types'
import type { HonorarioMensal } from './types'

function linha(r: HonorarioMensal) {
  return {
    'Competência':    formatCompetencia(r.competencia),
    'Cliente':        r.cliente?.nome ?? r.cliente_id,
    'Tipo':           r.tipo === 'extra'
                        ? `Extra ${r.parcela_num ?? ''}/${r.parcela_total ?? ''}`
                        : 'Recorrente',
    'Valor devido':   r.valor_devido + r.saldo_anterior,
    'Saldo anterior': r.saldo_anterior,
    'Valor pago':     r.valor_pago,
    'Saldo pendente': r.saldo_pendente,
    'Vencimento':     r.vencimento ?? '',
    'Status':         HONORARIO_STATUS_LABELS[r.status],
    'Data pagamento': r.data_pagamento ?? '',
    'Forma':          r.forma_pagamento ?? '',
    'Responsável':    r.responsavel?.nome ?? '',
    'Observações':    r.observacoes ?? '',
    'Cancelado':      r.cancelado ? 'Sim' : 'Não',
  }
}

export function gerarHonorariosXlsx(registros: HonorarioMensal[], nomeAba = 'Honorários'): Uint8Array {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(registros.map(linha))
  XLSX.utils.book_append_sheet(wb, ws, nomeAba.slice(0, 31))
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
}
