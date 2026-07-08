import { describe, it, expect } from 'vitest'
import {
  competenciaDe,
  addMeses,
  competenciaSeguinte,
  dataVencimento,
  formatCompetencia,
  computeStatusSugerido,
  computeTotais,
  computeDashboard,
  montarParcelasExtra,
  montarRegistrosDoMes,
  montarRegistrosProximoMes,
} from './service'
import type { HonorarioContrato, HonorarioExtra, HonorarioMensal } from './types'

function extra(over: Partial<HonorarioExtra> = {}): HonorarioExtra {
  return {
    id: over.id ?? 'extra-1',
    cliente_id: over.cliente_id ?? 'cli-1',
    descricao: over.descricao ?? 'Honorário extra',
    valor_total: over.valor_total ?? 1000,
    num_parcelas: over.num_parcelas ?? 1,
    forma_pagamento: null,
    primeira_competencia: over.primeira_competencia ?? '2026-07-01',
    status: 'ativo',
    observacoes: null,
    criado_por: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  }
}

function contrato(over: Partial<HonorarioContrato> = {}): HonorarioContrato {
  return {
    id: over.id ?? `contrato-${over.cliente_id ?? 'x'}`,
    cliente_id: over.cliente_id ?? 'cli-1',
    valor_mensal: over.valor_mensal ?? 1000,
    dia_vencimento: over.dia_vencimento ?? 10,
    isento: over.isento ?? false,
    status: over.status ?? 'ativo',
    data_inicio: '2026-01-01',
    data_fim: null,
    observacoes: null,
    criado_por: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function registro(over: Partial<HonorarioMensal> = {}): HonorarioMensal {
  const valor_devido = over.valor_devido ?? 1000
  const saldo_anterior = over.saldo_anterior ?? 0
  const valor_pago = over.valor_pago ?? 0
  return {
    id: over.id ?? `reg-${over.cliente_id ?? 'x'}`,
    competencia: over.competencia ?? '2026-07-01',
    cliente_id: over.cliente_id ?? 'cli-1',
    contrato_id: over.contrato_id ?? null,
    valor_devido,
    saldo_anterior,
    valor_pago,
    saldo_pendente: over.saldo_pendente ?? (valor_devido + saldo_anterior - valor_pago),
    vencimento: over.vencimento ?? '2026-07-10',
    status: over.status ?? 'pendente',
    data_pagamento: null,
    forma_pagamento: null,
    observacoes: null,
    responsavel_lancamento_id: null,
    tipo: over.tipo ?? 'recorrente',
    extra_id: over.extra_id ?? null,
    parcela_num: over.parcela_num ?? null,
    parcela_total: over.parcela_total ?? null,
    cancelado: over.cancelado ?? false,
    cancelado_em: null,
    cancelado_por: null,
    arquivado: false,
    criado_por: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  }
}

describe('competência e datas', () => {
  it('normaliza para o dia 01', () => {
    expect(competenciaDe('2026-07-23')).toBe('2026-07-01')
  })
  it('soma meses cruzando o ano', () => {
    expect(addMeses('2026-11-01', 3)).toBe('2027-02-01')
    expect(addMeses('2026-01-01', -1)).toBe('2025-12-01')
  })
  it('competência seguinte', () => {
    expect(competenciaSeguinte('2026-12-01')).toBe('2027-01-01')
  })
  it('limita o dia de vencimento ao último dia do mês', () => {
    expect(dataVencimento('2026-02-01', 31)).toBe('2026-02-28')
    expect(dataVencimento('2026-07-01', 10)).toBe('2026-07-10')
  })
  it('formata competência', () => {
    expect(formatCompetencia('2026-07-01')).toBe('Julho/2026')
  })
})

describe('computeStatusSugerido', () => {
  const hoje = '2026-07-15'
  it('pago quando quita o total', () => {
    expect(computeStatusSugerido(registro({ valor_pago: 1000 }), hoje)).toBe('pago')
  })
  it('parcial quando paga uma parte', () => {
    expect(computeStatusSugerido(registro({ valor_pago: 400 }), hoje)).toBe('parcial')
  })
  it('em_atraso quando nada pago e já venceu', () => {
    expect(computeStatusSugerido(registro({ valor_pago: 0, vencimento: '2026-07-10' }), hoje)).toBe('em_atraso')
  })
  it('pendente quando nada pago e ainda não venceu', () => {
    expect(computeStatusSugerido(registro({ valor_pago: 0, vencimento: '2026-07-20' }), hoje)).toBe('pendente')
  })
  it('preserva isento', () => {
    expect(computeStatusSugerido(registro({ status: 'isento', valor_pago: 0 }), hoje)).toBe('isento')
  })
  it('considera saldo anterior no total devido', () => {
    // devido 1000 + saldo 500 = 1500; pagou 1500 → pago
    expect(computeStatusSugerido(registro({ saldo_anterior: 500, valor_pago: 1500 }), hoje)).toBe('pago')
  })
})

describe('computeTotais', () => {
  it('soma previsto/recebido/pendente e conta status', () => {
    const t = computeTotais([
      registro({ cliente_id: 'a', valor_devido: 1000, valor_pago: 1000, status: 'pago' }),
      registro({ cliente_id: 'b', valor_devido: 1000, valor_pago: 400, status: 'parcial' }),
      registro({ cliente_id: 'c', valor_devido: 1000, valor_pago: 0, status: 'em_atraso' }),
      registro({ cliente_id: 'd', valor_devido: 800, valor_pago: 0, status: 'isento' }),
    ])
    // isento não entra no previsto
    expect(t.previsto).toBe(3000)
    expect(t.recebido).toBe(1400)
    expect(t.pendente).toBe(1600) // 0 + 600 + 1000 + 0
    expect(t.emDia).toBe(1)
    expect(t.parciais).toBe(1)
    expect(t.emAtraso).toBe(1)
    expect(t.isentos).toBe(1)
    expect(t.totalRegistros).toBe(4)
  })
})

describe('computeTotais ignora cancelado', () => {
  it('não conta registros cancelados', () => {
    const t = computeTotais([
      registro({ cliente_id: 'a', valor_pago: 1000, status: 'pago' }),
      registro({ cliente_id: 'b', valor_devido: 1000, status: 'pendente', cancelado: true }),
    ])
    expect(t.totalRegistros).toBe(1)
    expect(t.previsto).toBe(1000)
    expect(t.pendente).toBe(0)
  })
})

describe('computeDashboard', () => {
  it('calcula adimplência, atraso e inadimplentes (ignora isento/cancelado)', () => {
    const d = computeDashboard([
      registro({ cliente_id: 'a', valor_pago: 1000, status: 'pago' }),
      registro({ cliente_id: 'b', valor_pago: 0, status: 'em_atraso', saldo_pendente: 1000 }),
      registro({ cliente_id: 'c', status: 'isento', valor_devido: 0, saldo_pendente: 0 }),
      registro({ cliente_id: 'd', status: 'pendente', cancelado: true }),
    ])
    expect(d.cobraveis).toBe(2)          // a, b (isento e cancelado fora)
    expect(d.adimplenciaPct).toBe(50)    // 1 pago / 2 cobráveis
    expect(d.emAtraso).toBe(1000)
    expect(d.clientesInadimplentes).toBe(1)
  })
})

describe('montarParcelasExtra', () => {
  it('gera N parcelas em meses consecutivos e fecha o valor total', () => {
    const parcelas = montarParcelasExtra(extra({ valor_total: 1000, num_parcelas: 3, primeira_competencia: '2026-07-01' }))
    expect(parcelas).toHaveLength(3)
    expect(parcelas.map(p => p.competencia)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01'])
    expect(parcelas.every(p => p.tipo === 'extra' && p.extra_id === 'extra-1')).toBe(true)
    expect(parcelas[0].parcela_num).toBe(1)
    expect(parcelas[2].parcela_total).toBe(3)
    const soma = Math.round(parcelas.reduce((s, p) => s + p.valor_devido, 0) * 100) / 100
    expect(soma).toBe(1000)
  })
  it('ajusta o resíduo de arredondamento na última parcela', () => {
    const parcelas = montarParcelasExtra(extra({ valor_total: 100, num_parcelas: 3 }))
    expect(parcelas[0].valor_devido).toBe(33.33)
    expect(parcelas[2].valor_devido).toBe(33.34)
  })
})

describe('montarRegistrosDoMes', () => {
  it('gera 1 registro por contrato ativo sem registro existente', () => {
    const contratos = [contrato({ cliente_id: 'a' }), contrato({ cliente_id: 'b', isento: true })]
    const novos = montarRegistrosDoMes('2026-07-01', contratos, [])
    expect(novos).toHaveLength(2)
    const a = novos.find(n => n.cliente_id === 'a')!
    expect(a.valor_devido).toBe(1000)
    expect(a.status).toBe('pendente')
    const b = novos.find(n => n.cliente_id === 'b')!
    expect(b.valor_devido).toBe(0)
    expect(b.status).toBe('isento')
  })
  it('não duplica quem já tem registro no mês', () => {
    const contratos = [contrato({ cliente_id: 'a' })]
    const novos = montarRegistrosDoMes('2026-07-01', contratos, [registro({ cliente_id: 'a' })])
    expect(novos).toHaveLength(0)
  })
  it('ignora contratos não ativos', () => {
    const contratos = [contrato({ cliente_id: 'a', status: 'suspenso' })]
    expect(montarRegistrosDoMes('2026-07-01', contratos, [])).toHaveLength(0)
  })
})

describe('montarRegistrosProximoMes (carry-over)', () => {
  it('carrega o saldo pendente como saldo_anterior no mês seguinte', () => {
    const contratos = [contrato({ cliente_id: 'a', valor_mensal: 1000, dia_vencimento: 10 })]
    const mesFechado = [
      registro({ cliente_id: 'a', valor_devido: 1000, valor_pago: 400, status: 'parcial', saldo_pendente: 600 }),
    ]
    const novos = montarRegistrosProximoMes('2026-07-01', contratos, mesFechado)
    expect(novos).toHaveLength(1)
    expect(novos[0].competencia).toBe('2026-08-01')
    expect(novos[0].valor_devido).toBe(1000)
    expect(novos[0].saldo_anterior).toBe(600)
    expect(novos[0].vencimento).toBe('2026-08-10')
  })
  it('não carrega saldo de quem está pago', () => {
    const contratos = [contrato({ cliente_id: 'a' })]
    const mesFechado = [registro({ cliente_id: 'a', valor_pago: 1000, status: 'pago', saldo_pendente: 0 })]
    const novos = montarRegistrosProximoMes('2026-07-01', contratos, mesFechado)
    expect(novos[0].saldo_anterior).toBe(0)
  })
  it('gera carry-over-only para cliente com saldo mas sem contrato ativo', () => {
    const mesFechado = [
      registro({ cliente_id: 'z', valor_devido: 500, valor_pago: 0, status: 'em_atraso', saldo_pendente: 500 }),
    ]
    const novos = montarRegistrosProximoMes('2026-07-01', [], mesFechado)
    expect(novos).toHaveLength(1)
    expect(novos[0].cliente_id).toBe('z')
    expect(novos[0].valor_devido).toBe(0)
    expect(novos[0].saldo_anterior).toBe(500)
    expect(novos[0].contrato_id).toBeNull()
  })
  it('não duplica quem já tem registro no mês seguinte', () => {
    const contratos = [contrato({ cliente_id: 'a' })]
    const mesFechado = [registro({ cliente_id: 'a', status: 'pendente', saldo_pendente: 1000 })]
    const jaExiste = [registro({ cliente_id: 'a', competencia: '2026-08-01' })]
    const novos = montarRegistrosProximoMes('2026-07-01', contratos, mesFechado, jaExiste)
    expect(novos).toHaveLength(0)
  })
})
