import { describe, expect, it } from 'vitest'
import { DESPESAS_EXTRA_USER_IDS, podeAcessarDespesas, podeGerenciarLancamentoDespesa } from './despesas-acesso'

const CELIO_ID = DESPESAS_EXTRA_USER_IDS[0]
const OUTRO_ADMINISTRATIVO_ID = 'outro-usuario-administrativo'

describe('podeAcessarDespesas', () => {
  it('sócio sempre pode, independente do id', () => {
    expect(podeAcessarDespesas('qualquer-id', 'socio')).toBe(true)
  })

  it('usuário da lista extra pode, mesmo sem ser sócio', () => {
    expect(podeAcessarDespesas(CELIO_ID, 'administrativo')).toBe(true)
  })

  it('outro usuário com o mesmo papel NÃO pode (exceção é por pessoa, não por papel)', () => {
    expect(podeAcessarDespesas(OUTRO_ADMINISTRATIVO_ID, 'administrativo')).toBe(false)
  })

  it('demais papéis sem o id na lista não podem', () => {
    expect(podeAcessarDespesas('qualquer-id', 'advogado')).toBe(false)
    expect(podeAcessarDespesas('qualquer-id', 'gerente')).toBe(false)
  })
})

describe('podeGerenciarLancamentoDespesa', () => {
  it('sócio e gerente podem gerenciar qualquer tipo de lançamento', () => {
    expect(podeGerenciarLancamentoDespesa('x', 'socio',   'receita')).toBe(true)
    expect(podeGerenciarLancamentoDespesa('x', 'gerente', 'despesa')).toBe(true)
  })

  it('usuário extra só pode gerenciar lançamentos do tipo despesa', () => {
    expect(podeGerenciarLancamentoDespesa(CELIO_ID, 'administrativo', 'despesa')).toBe(true)
    expect(podeGerenciarLancamentoDespesa(CELIO_ID, 'administrativo', 'receita')).toBe(false)
  })

  it('outro usuário administrativo não pode gerenciar nada', () => {
    expect(podeGerenciarLancamentoDespesa(OUTRO_ADMINISTRATIVO_ID, 'administrativo', 'despesa')).toBe(false)
  })
})
