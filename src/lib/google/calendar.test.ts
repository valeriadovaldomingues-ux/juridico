import { describe, expect, it } from 'vitest'
import { lerContaDeServico } from './calendar'

const conta = { type: 'service_account', client_email: 'sa@projeto.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n' }

describe('lerContaDeServico', () => {
  it('lê o JSON puro, inclusive com quebras de linha e espaços nas pontas', () => {
    expect(lerContaDeServico(`\n${JSON.stringify(conta, null, 2)}\n`)).toEqual(conta)
  })

  it('lê o JSON em base64', () => {
    expect(lerContaDeServico(Buffer.from(JSON.stringify(conta)).toString('base64'))).toEqual(conta)
  })

  it('rejeita texto sem citar o conteúdo', () => {
    const lixo = '\ttype\t"service_account" SEGREDO'
    expect(() => lerContaDeServico(lixo)).toThrow(/não é um JSON válido/)
    expect(() => lerContaDeServico(lixo)).not.toThrow(/SEGREDO/)
    expect(() => lerContaDeServico(undefined)).toThrow(/não é um JSON válido/)
  })
})
