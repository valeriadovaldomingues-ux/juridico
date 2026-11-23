import { describe, expect, it } from 'vitest'
import type { Cobranca, CobrancaInsertRow } from '../types/cobrancas'
import type { CobrancasStore } from './cobrancas-store'
import { createRecurringCobrancasAction } from './cobrancas-workflow'
import { montarPlano } from './cobrancas-parcelas'

const CLIENTE = 'c0000000-0000-4000-8000-000000000001'
const USER = 'u0000000-0000-4000-8000-000000000001'

function lojaFalsa() {
  const criadas: CobrancaInsertRow[] = []
  const eventos: unknown[] = []
  const store: CobrancasStore = {
    findProcessoById: async () => null,
    findCobrancaById: async () => null,
    findCobrancaByInterId: async () => null,
    findDuplicateCharge: async () => null,
    createCharge: async input => ({ ...input, id: 'x' } as unknown as Cobranca),
    createCharges: async inputs => {
      criadas.push(...inputs)
      return inputs.map((r, i) => ({ ...r, id: `id-${i}` }) as unknown as Cobranca)
    },
    updateCharge: async () => null,
    deleteCharge: async () => true,
    insertEvent: async row => { eventos.push(row) },
    insertLog: async () => {},
    insertWebhookEvent: async () => ({ id: 'w' }),
    updateWebhookEvent: async () => {},
  }
  return { store, criadas, eventos }
}

const corpoBase = {
  cliente_id: CLIENTE,
  descricao: 'Honorários advocatícios — advocacia de partido',
  data_vencimento_inicial: '2026-11-10',
  dia_vencimento: 10,
  tipo_caso: 'partido',
}

describe('gerar cobranças de advocacia de partido, mês a mês', () => {
  it('cria uma cobrança por mês com o valor de cada parcela (incluindo o 13º calculado pela tela)', async () => {
    const { store, criadas } = lojaFalsa()
    // O que a tela monta: 3 meses (nov, dez, jan), dezembro com 13º igual ao valor do mês.
    const plano = montarPlano({ vencimentoInicial: '2026-11-10', quantidade: 3, diaVencimento: 10, valoresMensais: ['1000', '1100', '1200'], incluir13: true })
    const valores = plano.parcelas.map(p => p.valor as number)
    expect(valores).toEqual([1000, 2200, 1200])

    const r = await createRecurringCobrancasAction({ role: 'socio', userId: USER, store, body: { ...corpoBase, quantidade_parcelas: 3, valores_mensais: valores } })
    expect(r.ok).toBe(true)
    expect(criadas.map(c => [c.data_vencimento, c.valor, c.parcela_numero, c.parcela_total])).toEqual([
      ['2026-11-10', 1000, 1, 3],
      ['2026-12-10', 2200, 2, 3],
      ['2027-01-10', 1200, 3, 3],
    ])
    expect(criadas.every(c => c.tipo_caso === 'partido' && c.descricao === corpoBase.descricao)).toBe(true)
  })

  it('exige um valor para cada parcela', async () => {
    const { store, criadas } = lojaFalsa()
    const r = await createRecurringCobrancasAction({ role: 'socio', userId: USER, store, body: { ...corpoBase, quantidade_parcelas: 3, valores_mensais: [1000, 1000] } })
    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(criadas).toHaveLength(0)
  })

  it('recusa parcela abaixo de R$ 2,50', async () => {
    const { store, criadas } = lojaFalsa()
    const r = await createRecurringCobrancasAction({ role: 'socio', userId: USER, store, body: { ...corpoBase, quantidade_parcelas: 2, valores_mensais: [1000, 2.49] } })
    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(criadas).toHaveLength(0)
  })

  it('só quem tem permissão financeira gera (estagiário não)', async () => {
    const { store, criadas } = lojaFalsa()
    const r = await createRecurringCobrancasAction({ role: 'estagiario', userId: USER, store, body: { ...corpoBase, quantidade_parcelas: 1, valores_mensais: [1000] } })
    expect(r).toMatchObject({ ok: false, status: 403 })
    expect(criadas).toHaveLength(0)
  })
})
