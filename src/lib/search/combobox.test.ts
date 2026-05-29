import { describe, expect, it } from 'vitest'
import { filterComboboxOptions, normalizeComboboxText } from './combobox'

describe('combobox search helpers', () => {
  it('normaliza acentos e caixa para busca', () => {
    expect(normalizeComboboxText('João da Silva')).toBe('joaodasilva')
  })

  it('filtra por label, descrição e keywords com limite', () => {
    const options = [
      { value: '1', label: 'Cliente João', description: 'CPF 123.456.789-00', keywords: ['financeiro'] },
      { value: '2', label: 'Processo XYZ', description: 'Área Cível', keywords: ['joao', 'silva'] },
      { value: '3', label: 'Outro', description: 'Sem relação', keywords: ['irrelevante'] },
    ]

    expect(filterComboboxOptions(options, 'joao', 10).map(o => o.value)).toEqual(['1', '2'])
    expect(filterComboboxOptions(options, '12345678900', 10).map(o => o.value)).toEqual(['1'])
    expect(filterComboboxOptions(options, '', 1).map(o => o.value)).toEqual(['1'])
  })
})
