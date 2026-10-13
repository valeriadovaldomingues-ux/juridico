import { describe, expect, it } from 'vitest'
import { ABAS_FINANCEIRO_LIBERADO, FINANCEIRO_EXTRA_USER_IDS, financeiroLiberadoPorUsuario, podeAcessarFinanceiro, podeAcessarSalarios } from './financeiro-acesso'

const CELIO = FINANCEIRO_EXTRA_USER_IDS[0]

describe('acesso ao Financeiro por usuário', () => {
  it('sócio sempre; Célio por estar na lista; outros não', () => {
    expect(podeAcessarFinanceiro('qualquer', 'socio')).toBe(true)
    expect(podeAcessarFinanceiro(CELIO, 'administrativo')).toBe(true)
    expect(podeAcessarFinanceiro('outro-adm', 'administrativo')).toBe(false)
    expect(podeAcessarFinanceiro(null, 'gerente')).toBe(false)
  })

  it('liberado por usuário só vale para quem está na lista', () => {
    expect(financeiroLiberadoPorUsuario(CELIO)).toBe(true)
    expect(financeiroLiberadoPorUsuario('outro')).toBe(false)
    expect(financeiroLiberadoPorUsuario(undefined)).toBe(false)
  })
})

describe('Salários e abas liberadas', () => {
  it('sócio e Célio acessam Salários; os demais não', () => {
    expect(podeAcessarSalarios('x', 'socio')).toBe(true)
    expect(podeAcessarSalarios(CELIO, 'administrativo')).toBe(true)
    expect(podeAcessarSalarios('outro-adm', 'administrativo')).toBe(false)
    expect(podeAcessarSalarios('x', 'gerente')).toBe(false)
  })

  it('quem é liberado individualmente só vê despesas, pedidos a pagar, a pagar e salários (nada de receita)', () => {
    expect([...ABAS_FINANCEIRO_LIBERADO]).toEqual(['despesas', 'pedidos', 'pagar', 'salarios'])
    for (const aba of ['grade', 'receitas', 'receber', 'lancamentos', 'relatorios']) {
      expect(ABAS_FINANCEIRO_LIBERADO as readonly string[]).not.toContain(aba)
    }
  })
})
