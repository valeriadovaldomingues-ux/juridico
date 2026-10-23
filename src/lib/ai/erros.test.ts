import { describe, expect, it } from 'vitest'
import { mensagemFalhaIA } from './erros'

describe('mensagemFalhaIA', () => {
  it('explica quando a conta da OpenAI ficou sem crédito', () => {
    expect(mensagemFalhaIA({ status: 429, code: 'credit_balance_exhausted' }, 'padrão')).toMatch(/créditos da IA acabaram/)
    expect(mensagemFalhaIA({ status: 429, type: 'insufficient_quota' }, 'padrão')).toMatch(/Billing/)
  })
  it('outros erros mantêm a mensagem padrão', () => {
    expect(mensagemFalhaIA({ status: 500 }, 'padrão')).toBe('padrão')
    expect(mensagemFalhaIA(new Error('x'), 'padrão')).toBe('padrão')
  })
})
