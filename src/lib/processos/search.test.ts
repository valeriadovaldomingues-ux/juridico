import { describe, expect, it } from 'vitest'
import { buildClienteLookupDescription, buildProcessoLookupOption } from './search'

describe('processos search helpers', () => {
  it('monta opção de processo com metadados pesquisáveis', () => {
    const option = buildProcessoLookupOption({
      id: 'proc-1',
      numero_processo: '0001234-56.2026.8.26.0100',
      titulo: 'Ação de Cobrança',
      area_direito: 'civil',
      status: 'ativo',
      cliente: { nome: 'João da Silva' },
      partes_processo: [
        { pessoa_nome: 'Empresa XYZ', tipo_parte: 'reu' },
      ],
    })

    expect(option.label).toContain('0001234-56.2026.8.26.0100')
    expect(option.description).toContain('Cliente: João da Silva')
    expect(option.description).toContain('Parte contrária: Empresa XYZ')
    expect(option.keywords).toEqual(expect.arrayContaining([
      '0001234-56.2026.8.26.0100',
      'Ação de Cobrança',
      'João da Silva',
      'Empresa XYZ',
      'Cível',
      'ativo',
    ]))
  })

  it('formata descrição de cliente com cpf/cnpj, telefone e e-mail', () => {
    expect(buildClienteLookupDescription({
      cpf_cnpj: '12345678900',
      telefone: '(11) 99999-0000',
      email: 'joao@example.com',
    })).toContain('123.456.789-00')
  })
})
