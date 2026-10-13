import { describe, expect, it } from 'vitest'
import { FINANCEIRO_EXTRA_USER_IDS, financeiroLiberadoPorUsuario, podeAcessarFinanceiro } from './financeiro-acesso'

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
