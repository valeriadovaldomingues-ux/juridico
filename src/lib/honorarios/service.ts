// Lógica de negócio (pura) do Controle de Honorários.
// Sem acesso a banco — as rotas de API fazem I/O e chamam estas funções.
// Datas trabalhadas como strings 'YYYY-MM-DD' para evitar problemas de fuso.

import type {
  HonorarioContrato,
  HonorarioDashboard,
  HonorarioExtra,
  HonorarioMensal,
  HonorarioStatus,
  HonorarioTotais,
  NovoRegistroMensal,
} from './types'

// ─── Competência (mês de referência) ─────────────────────────────────────────

/** Normaliza qualquer data para o primeiro dia do mês: 'YYYY-MM-01'. */
export function competenciaDe(data: string | Date): string {
  const d = typeof data === 'string' ? data : data.toISOString().slice(0, 10)
  return `${d.slice(0, 7)}-01`
}

export function competenciaAtual(hoje: Date = new Date()): string {
  return competenciaDe(hoje.toISOString().slice(0, 10))
}

/** Soma `n` meses a uma competência 'YYYY-MM-01' (n pode ser negativo). */
export function addMeses(competencia: string, n: number): string {
  const ano = Number(competencia.slice(0, 4))
  const mes = Number(competencia.slice(5, 7)) // 1-12
  const total = ano * 12 + (mes - 1) + n
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return `${String(novoAno).padStart(4, '0')}-${String(novoMes).padStart(2, '0')}-01`
}

export function competenciaSeguinte(competencia: string): string {
  return addMeses(competencia, 1)
}

/** Último dia do mês de uma competência. */
function ultimoDiaDoMes(competencia: string): number {
  const ano = Number(competencia.slice(0, 4))
  const mes = Number(competencia.slice(5, 7))
  return new Date(ano, mes, 0).getDate()
}

/** Data de vencimento numa competência, com o dia limitado ao último do mês. */
export function dataVencimento(competencia: string, diaVencimento: number): string {
  const dia = Math.min(Math.max(diaVencimento, 1), ultimoDiaDoMes(competencia))
  return `${competencia.slice(0, 7)}-${String(dia).padStart(2, '0')}`
}

/** Rótulo amigável: 'YYYY-MM-01' → 'Julho/2026'. */
export function formatCompetencia(competencia: string): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  const mes = Number(competencia.slice(5, 7))
  return `${meses[mes - 1] ?? competencia.slice(5, 7)}/${competencia.slice(0, 4)}`
}

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Status sugerido a partir dos valores. NÃO sobrescreve 'isento'
 * (decisão de negócio manual). Usado no fechamento para marcar em_atraso
 * e como sugestão na UI.
 */
export function computeStatusSugerido(
  registro: Pick<HonorarioMensal, 'valor_devido' | 'saldo_anterior' | 'valor_pago' | 'vencimento' | 'status'>,
  hojeISO: string = new Date().toISOString().slice(0, 10),
): HonorarioStatus {
  if (registro.status === 'isento') return 'isento'

  const totalDevido = round2(registro.valor_devido + registro.saldo_anterior)
  const pago = registro.valor_pago

  if (totalDevido <= 0) return 'pago'
  if (pago >= totalDevido) return 'pago'
  if (pago > 0) return 'parcial'

  // Nada pago: em atraso se já venceu.
  if (registro.vencimento && registro.vencimento < hojeISO) return 'em_atraso'
  return 'pendente'
}

// ─── Totais ──────────────────────────────────────────────────────────────────

export function computeTotais(registros: HonorarioMensal[]): HonorarioTotais {
  // Cancelados nunca entram nos totais (histórico/auditoria apenas).
  const ativos = registros.filter(r => !r.cancelado)
  const t: HonorarioTotais = {
    previsto: 0, recebido: 0, pendente: 0,
    emDia: 0, pendentes: 0, parciais: 0, emAtraso: 0, isentos: 0,
    totalRegistros: ativos.length,
  }
  for (const r of ativos) {
    if (r.status !== 'isento') {
      t.previsto = round2(t.previsto + r.valor_devido + r.saldo_anterior)
    }
    t.recebido = round2(t.recebido + r.valor_pago)
    if (r.status !== 'isento') {
      t.pendente = round2(t.pendente + Math.max(0, r.saldo_pendente))
    }
    switch (r.status) {
      case 'pago':      t.emDia += 1; break
      case 'pendente':  t.pendentes += 1; break
      case 'parcial':   t.parciais += 1; break
      case 'em_atraso': t.emAtraso += 1; break
      case 'isento':    t.isentos += 1; break
    }
  }
  return t
}

// ─── Dashboard financeiro ────────────────────────────────────────────────────

export function computeDashboard(registros: HonorarioMensal[]): HonorarioDashboard {
  const ativos = registros.filter(r => !r.cancelado)
  const t = computeTotais(ativos)
  const cobraveis = ativos.filter(r => r.status !== 'isento')
  const pagos = cobraveis.filter(r => r.status === 'pago').length
  const emAtraso = round2(
    ativos.filter(r => r.status === 'em_atraso').reduce((s, r) => s + Math.max(0, r.saldo_pendente), 0),
  )
  const clientesInadimplentes = new Set(
    ativos.filter(r => r.status === 'em_atraso').map(r => r.cliente_id),
  ).size
  return {
    previsto: t.previsto,
    recebido: t.recebido,
    pendente: t.pendente,
    emAtraso,
    adimplenciaPct: cobraveis.length > 0 ? Math.round((pagos / cobraveis.length) * 100) : 100,
    clientesInadimplentes,
    cobraveis: cobraveis.length,
  }
}

// ─── Honorários extras / isolados (parcelas) ─────────────────────────────────

/** Uma linha `tipo='extra'` por parcela, em meses consecutivos. Última parcela
 *  ajusta o resíduo de arredondamento para bater o valor_total. */
export function montarParcelasExtra(extra: HonorarioExtra, diaVencimento = 10): NovoRegistroMensal[] {
  const n = Math.max(1, extra.num_parcelas)
  const valorParcela = round2(extra.valor_total / n)
  const primeira = competenciaDe(extra.primeira_competencia)
  const rows: NovoRegistroMensal[] = []
  let acumulado = 0
  for (let i = 0; i < n; i++) {
    const comp = addMeses(primeira, i)
    const valor = i === n - 1 ? round2(extra.valor_total - acumulado) : valorParcela
    acumulado = round2(acumulado + valor)
    rows.push({
      competencia: comp,
      cliente_id: extra.cliente_id,
      contrato_id: null,
      valor_devido: valor,
      saldo_anterior: 0,
      vencimento: dataVencimento(comp, diaVencimento),
      status: 'pendente',
      tipo: 'extra',
      extra_id: extra.id,
      parcela_num: i + 1,
      parcela_total: n,
    })
  }
  return rows
}

// ─── Geração e carry-over de registros mensais ───────────────────────────────

const STATUS_COM_PENDENCIA: HonorarioStatus[] = ['pendente', 'parcial', 'em_atraso']

/**
 * Registros a criar para uma competência a partir dos contratos ativos,
 * ignorando os que já existem (respeita o UNIQUE cliente+competência).
 * Usado no bootstrap ("Gerar mês") — sem saldo anterior.
 */
export function montarRegistrosDoMes(
  competencia: string,
  contratosAtivos: HonorarioContrato[],
  registrosExistentes: HonorarioMensal[],
): NovoRegistroMensal[] {
  // Só considera registros RECORRENTES para evitar pular clientes que só têm extras.
  const jaTem = new Set(registrosExistentes.filter(r => r.tipo === 'recorrente').map(r => r.cliente_id))
  return contratosAtivos
    .filter(c => c.status === 'ativo' && !jaTem.has(c.cliente_id))
    .map(c => ({
      competencia,
      cliente_id: c.cliente_id,
      contrato_id: c.id,
      valor_devido: c.isento ? 0 : c.valor_mensal,
      saldo_anterior: 0,
      vencimento: dataVencimento(competencia, c.dia_vencimento),
      status: c.isento ? 'isento' : 'pendente',
      tipo: 'recorrente',
    }))
}

/**
 * Registros do mês SEGUINTE ao fechar `competencia`:
 *  - um por contrato ativo (valor do contrato + saldo anterior do cliente);
 *  - carry-over para clientes com saldo pendente mas sem contrato ativo
 *    (para não perder dívida quando o contrato encerrou).
 * Ignora quem já tem registro na competência seguinte.
 */
export function montarRegistrosProximoMes(
  competenciaFechada: string,
  contratosAtivos: HonorarioContrato[],
  registrosMesFechado: HonorarioMensal[],
  registrosProximoExistentes: HonorarioMensal[] = [],
): NovoRegistroMensal[] {
  const proxima = competenciaSeguinte(competenciaFechada)
  const jaTem = new Set(registrosProximoExistentes.filter(r => r.tipo === 'recorrente').map(r => r.cliente_id))

  // Carry-over só do honorário RECORRENTE não-cancelado (extras têm parcelas próprias).
  const saldoPorCliente = new Map<string, number>()
  for (const r of registrosMesFechado) {
    if (r.tipo !== 'recorrente' || r.cancelado) continue
    if (STATUS_COM_PENDENCIA.includes(r.status) && r.saldo_pendente > 0) {
      saldoPorCliente.set(r.cliente_id, round2(r.saldo_pendente))
    }
  }

  const novos: NovoRegistroMensal[] = []
  const cobertos = new Set<string>()

  for (const c of contratosAtivos) {
    if (c.status !== 'ativo' || jaTem.has(c.cliente_id)) continue
    const saldoAnterior = saldoPorCliente.get(c.cliente_id) ?? 0
    cobertos.add(c.cliente_id)
    novos.push({
      competencia: proxima,
      cliente_id: c.cliente_id,
      contrato_id: c.id,
      valor_devido: c.isento ? 0 : c.valor_mensal,
      saldo_anterior: saldoAnterior,
      vencimento: dataVencimento(proxima, c.dia_vencimento),
      status: c.isento ? 'isento' : 'pendente',
      tipo: 'recorrente',
    })
  }

  // Carry-over para clientes com saldo mas sem contrato ativo.
  for (const [clienteId, saldo] of saldoPorCliente) {
    if (cobertos.has(clienteId) || jaTem.has(clienteId)) continue
    novos.push({
      competencia: proxima,
      cliente_id: clienteId,
      contrato_id: null,
      valor_devido: 0,
      saldo_anterior: saldo,
      vencimento: dataVencimento(proxima, 10),
      status: 'pendente',
      tipo: 'recorrente',
    })
  }

  return novos
}

// ─── Utils ───────────────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
