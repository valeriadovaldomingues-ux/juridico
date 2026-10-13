import { describe, expect, it } from 'vitest'
import type { InpiProcesso } from '@/types/inpi'
import { ordenarInpi, ordemInpiValida } from './ordenar'

const p = (titulo: string, extra: Partial<InpiProcesso> = {}): InpiProcesso => ({
  id: titulo, cliente_id: null, numero_processo: '1', tipo: 'marca', titulo, natureza: null, classe_nice: null,
  procurador: null, status: 'em_andamento', data_deposito: null, data_concessao: null, observacoes: null,
  nao_acompanhar: false, nao_acompanhar_motivo: null, nao_acompanhar_em: null, prorrogacoes: 0,
  created_by: null, created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z', ...extra,
})
const titulos = (l: InpiProcesso[]) => l.map(x => x.titulo)

describe('ordenarInpi', () => {
  it('alfabética ignora acento e maiúscula', () => {
    const l = [p('Zap'), p('Ótica Clarck'), p('abratec'), p('Brasótica'), p('Otica Amor')]
    expect(titulos(ordenarInpi(l, 'marca'))).toEqual(['abratec', 'Brasótica', 'Otica Amor', 'Ótica Clarck', 'Zap'])
  })

  it('não altera a lista original', () => {
    const l = [p('B'), p('A')]
    ordenarInpi(l, 'marca')
    expect(titulos(l)).toEqual(['B', 'A'])
  })

  it('por cliente: A–Z, sem cliente no fim, desempate pela marca', () => {
    const l = [
      p('Sem cliente'),
      p('Marca 2', { cliente: { id: '1', nome: 'Zeta', email: null, telefone: null, celular: null } }),
      p('Marca B', { cliente: { id: '2', nome: 'Alfa', email: null, telefone: null, celular: null } }),
      p('Marca A', { cliente: { id: '2', nome: 'Alfa', email: null, telefone: null, celular: null } }),
    ]
    expect(titulos(ordenarInpi(l, 'cliente'))).toEqual(['Marca A', 'Marca B', 'Marca 2', 'Sem cliente'])
  })

  it('por decênio: concessão mais antiga primeiro; sem concessão depois, em ordem alfabética', () => {
    const l = [
      p('Recente', { status: 'concedido', data_concessao: '2024-05-01' }),
      p('Em andamento'),
      p('Antiga', { status: 'concedido', data_concessao: '2016-09-20' }),
      p('Indeferida', { status: 'indeferido' }),
    ]
    expect(titulos(ordenarInpi(l, 'decenio'))).toEqual(['Antiga', 'Recente', 'Em andamento', 'Indeferida'])
  })

  it('por decênio conta as prorrogações: marca antiga já prorrogada vence depois', () => {
    const l = [
      p('Antiga prorrogada', { status: 'concedido', data_concessao: '2016-09-20', prorrogacoes: 1 }),
      p('Meio', { status: 'concedido', data_concessao: '2020-01-01' }),
    ]
    expect(titulos(ordenarInpi(l, 'decenio'))).toEqual(['Meio', 'Antiga prorrogada'])
  })

  it('por número usa ordem natural; recentes põe o cadastro mais novo primeiro', () => {
    const l = [p('X', { numero_processo: '10' }), p('Y', { numero_processo: '9' })]
    expect(titulos(ordenarInpi(l, 'numero'))).toEqual(['Y', 'X'])
    const r = [p('Velho', { created_at: '2026-09-22T00:00:00Z' }), p('Novo', { created_at: '2026-10-13T00:00:00Z' })]
    expect(titulos(ordenarInpi(r, 'recentes'))).toEqual(['Novo', 'Velho'])
  })
})

describe('ordemInpiValida', () => {
  it('valor desconhecido cai no padrão alfabético', () => {
    expect(ordemInpiValida('xyz')).toBe('marca')
    expect(ordemInpiValida(null)).toBe('marca')
    expect(ordemInpiValida('decenio')).toBe('decenio')
  })
})
