import { describe, expect, it } from 'vitest'
import { COBRANCAS_SELECT } from './cobrancas'

// A janela "Confirmar dados do pagador" e a emissão no Inter dependem destes campos do cliente.
// Se a lista de cobranças deixar de trazê-los, a janela abre vazia e pede tudo de novo.
describe('COBRANCAS_SELECT', () => {
  it.each(['cpf_cnpj', 'tipo_pessoa', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf'])(
    'traz %s do cliente',
    campo => {
      expect(COBRANCAS_SELECT).toMatch(new RegExp(`cliente:clientes\\([^)]*\\b${campo}\\b`))
    },
  )
})
