import { describe, it, expect } from 'vitest'
import { detectarIntencao, executarConsulta } from './consulta'
import type { HonorarioMensal } from './types'

function reg(cliente_id: string, status: HonorarioMensal['status']): HonorarioMensal {
  return {
    id: `reg-${cliente_id}`,
    competencia: '2026-07-01',
    cliente_id,
    contrato_id: null,
    valor_devido: 1000,
    saldo_anterior: 0,
    valor_pago: status === 'pago' ? 1000 : 0,
    saldo_pendente: status === 'pago' ? 0 : 1000,
    vencimento: '2026-07-10',
    status,
    data_pagamento: null,
    forma_pagamento: null,
    observacoes: null,
    responsavel_lancamento_id: null,
    tipo: 'recorrente',
    extra_id: null,
    parcela_num: null,
    parcela_total: null,
    cancelado: false,
    cancelado_em: null,
    cancelado_por: null,
    arquivado: false,
    criado_por: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  }
}

describe('detectarIntencao', () => {
  it('detecta "devendo"', () => {
    expect(detectarIntencao('quais clientes estão devendo?')).toBe('devendo')
    expect(detectarIntencao('quem está pendente')).toBe('devendo')
  })
  it('detecta "em dia" (com acento)', () => {
    expect(detectarIntencao('quais clientes estão em dia?')).toBe('em_dia')
    expect(detectarIntencao('quem já quitou')).toBe('em_dia')
  })
  it('detecta atraso/inadimplência com prioridade', () => {
    expect(detectarIntencao('clientes inadimplentes')).toBe('em_atraso')
    expect(detectarIntencao('quem está em atraso')).toBe('em_atraso')
  })
  it('detecta parcial e isento', () => {
    expect(detectarIntencao('pagamentos parciais')).toBe('parcial')
    expect(detectarIntencao('clientes isentos')).toBe('isento')
  })
  it('cai em "todos" quando não reconhece', () => {
    expect(detectarIntencao('bom dia, tudo bem?')).toBe('todos')
  })
})

describe('executarConsulta', () => {
  const registros = [
    reg('a', 'pago'),
    reg('b', 'pendente'),
    reg('c', 'parcial'),
    reg('d', 'em_atraso'),
    reg('e', 'isento'),
  ]
  it('"devendo" retorna pendente + parcial + em_atraso', () => {
    const r = executarConsulta('quem está devendo?', registros)
    expect(r.intencao).toBe('devendo')
    expect(r.registros.map(x => x.cliente_id).sort()).toEqual(['b', 'c', 'd'])
  })
  it('"em dia" retorna só pagos', () => {
    const r = executarConsulta('quais estão em dia?', registros)
    expect(r.registros.map(x => x.cliente_id)).toEqual(['a'])
  })
})
