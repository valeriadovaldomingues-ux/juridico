import { describe, it, expect } from 'vitest'
import { motivoDaFalhaDeEnvio } from './emails'

describe('motivoDaFalhaDeEnvio', () => {
  it('traz só código, comando e resposta do servidor', () => {
    const e = Object.assign(new Error('Invalid login: ...'), { code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535, response: '535 5.7.8 Authentication failed' })
    const m = motivoDaFalhaDeEnvio(e)
    expect(m).toContain('code=EAUTH')
    expect(m).toContain('command=AUTH PLAIN')
    expect(m).toContain('responseCode=535')
    expect(m).toContain('Authentication failed')
  })

  it('mascara e-mails que apareçam na resposta e não usa a mensagem do erro', () => {
    const e = Object.assign(new Error('falha para cliente@empresa.com.br código 123456'), { code: 'EENVELOPE', response: '550 recipient cliente@empresa.com.br rejected' })
    const m = motivoDaFalhaDeEnvio(e)
    expect(m).not.toContain('cliente@empresa.com.br')
    expect(m).not.toContain('123456')
    expect(m).toContain('[e-mail]')
  })

  it('erro sem detalhes não quebra', () => {
    expect(motivoDaFalhaDeEnvio(undefined)).toBe('erro desconhecido')
    expect(motivoDaFalhaDeEnvio(new Error('x'))).toBe('erro desconhecido')
  })
})
